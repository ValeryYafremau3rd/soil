import { normalizeStacks } from '../../../domain/inventory/loot.ts'
import { quantityOf } from '../../../domain/inventory/stacks.ts'
import type { ContainerContents, ItemStack } from '../../../domain/inventory/loot'
import type { InventoryAccess } from './InventoryAccess'
import type { InventoryLedger } from './InventoryLedger'

/** Inventory-owned state capabilities used to manage container contents. */
interface ContainerAccess extends InventoryAccess {
  readonly ledger: Pick<InventoryLedger, 'deposits' | 'temporaryContainers'>
}

/** Manages quest parcels and temporary loot without owning a second snapshot. */
export class InventoryContainerActions {
  private readonly inventory: ContainerAccess

  /**
   * Bind container operations to the owning inventory store.
   * @param {ContainerAccess} inventory - Snapshot reader, publication and deposit ledger.
   */
  constructor(inventory: ContainerAccess) {
    this.inventory = inventory
  }

  /**
   * Remove quest parcel copies from carried items, containers and deposit tracking.
   * @param {readonly string[]} itemIds - The item ids supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  discardItemsEverywhere = (itemIds: readonly string[]): void => {
    const ids = new Set(itemIds)

    /**
     * Perform filter.
     * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
     * @returns {ItemStack[]} The result described by the TypeScript return signature.
     */
    const filter = (items: readonly ItemStack[]) => items.filter(item => !ids.has(item.itemId))
    const items = filter(this.inventory.snapshot.items)
    const containers = Object.fromEntries(Object.entries(this.inventory.snapshot.containers).map(([id, container]) => [id, { ...container, items: filter(container.items) }]))

    for (const stored of this.inventory.ledger.deposits.values()) for (const id of ids) stored.delete(id)

    if (items.length !== this.inventory.snapshot.items.length || Object.entries(containers).some(([id, c]) => c.items.length !== this.inventory.snapshot.containers[id].items.length)) this.inventory.publish({ ...this.inventory.snapshot, items, containers })
  }

  /**
   * Prepare a quest parcel in its designated container without duplicating deposited goods.
   * @param {string} containerId - The container id supplied to this operation.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {boolean} unique - The unique supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  prepareQuestItem = (
    containerId: string,
    itemId: string,
    unique = true
  ): void => {
    const container = this.inventory.snapshot.containers[containerId]
    if (!container || !this.inventory.definitions[itemId]) return

    if (unique) this.discardItemsEverywhere([itemId])
    else if (quantityOf(container.items, itemId) > (this.inventory.ledger.deposits.get(containerId)?.get(itemId) ?? 0)) return

    this.inventory.publish({
      ...this.inventory.snapshot,
      containers: {
        ...this.inventory.snapshot.containers,
        [containerId]: {
          ...this.inventory.snapshot.containers[containerId],
          items: [...this.inventory.snapshot.containers[containerId].items, { itemId, quantity: 1 }]
        }
      }
    })
  }

  /**
   * Register validated temporary loot while leaving existing container state untouched.
   * @param {Pick<ContainerContents, "items" | "id" | "name" | "locationId">} container - The container supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  addTemporaryContainer = (container: Pick<ContainerContents, 'id' | 'name' | 'locationId' | 'items'>): void => {
    if (this.inventory.ledger.temporaryContainers.has(container.id)) return

    if (!container.id || Object.hasOwn(this.inventory.snapshot.containers, container.id)) throw new Error('Temporary container ID must be unique')

    for (const stack of container.items) {
      if (!this.inventory.definitions[stack.itemId] || !Number.isSafeInteger(stack.quantity) || stack.quantity < 1) throw new Error('Invalid temporary container item')
    }

    const items = normalizeStacks(container.items, this.inventory.stackLimit)
    this.inventory.ledger.temporaryContainers.add(container.id)
    this.inventory.publish({
      ...this.inventory.snapshot, containers: {
        ...this.inventory.snapshot.containers,
        [container.id]: { ...container, items, locked: false, lootOnly: true }
      }
    })
  }

  /**
   * Remove temporary loot and its deposit records, closing its menu if necessary.
   * @param {string} containerId - The container id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  removeTemporaryContainer = (containerId: string): void => {
    if (!this.inventory.ledger.temporaryContainers.delete(containerId)) return

    const containers = { ...this.inventory.snapshot.containers }
    delete containers[containerId]
    this.inventory.ledger.deposits.delete(containerId)
    this.inventory.publish({
      ...this.inventory.snapshot,
      containers,
      menu: this.inventory.snapshot.menu?.kind === 'container' && this.inventory.snapshot.menu.containerId === containerId ? null : this.inventory.snapshot.menu
    })
  }
}
