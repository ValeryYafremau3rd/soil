import type { ContainerSeed, ItemStack } from '../../../domain/inventory/loot'
import { quantityOf } from '../../../domain/inventory/stacks.ts'
import type { InventorySnapshot, LootPickup } from '../../contracts/inventory'
import type { SavedInventory } from '../../contracts/save'
import { EventChannel } from '../core/EventChannel.ts'

/**
 * Owns inventory ledger state and behavior.
 */
export class InventoryLedger {
  private readonly snapshot: () => InventorySnapshot

  /**
   * Initialize the InventoryLedger instance and its collaborators.
   * @param {() => InventorySnapshot} snapshot - State snapshot supplied to this operation.
   * @returns {InventoryLedger} The initialized instance.
   */
  constructor(snapshot: () => InventorySnapshot) {
    this.snapshot = snapshot
  }
  legendaryBarterStock?: NonNullable<SavedInventory['legendaryBarterStock']>

  readonly lootedCaches = new Set<string>()

  readonly deposits = new Map<string, Map<string, number>>()

  readonly temporaryContainers = new Set<string>()

  /**
   * Perform report loot for InventoryLedger.
   * @param {ContainerSeed} container - The container supplied to this operation.
   * @param {readonly ItemStack[]} before - The before supplied to this operation.
   * @param {readonly ItemStack[]} after - The after supplied to this operation.
   * @param {ReadonlyMap<string, number>} deposits - The deposits supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  reportLoot(
    container: ContainerSeed,
    before: readonly ItemStack[],
    after: readonly ItemStack[],
    deposits: ReadonlyMap<string, number>
  ): void {
    if (container.vendor) return

    const items = [...new Set(before.map(item => item.itemId))].flatMap(itemId => {
      const quantity = quantityOf(before, itemId) - quantityOf(after, itemId) - (deposits.get(itemId) ?? 0)

      return quantity > 0 ? [{ itemId, quantity }] : []
    })
    if (items.length) {
      if (container.refreshLoot) this.lootedCaches.add(container.id)

      this.lootListeners.emit({ containerId: container.id, items })
    }
  }

  /**
   * Perform report deposit for InventoryLedger.
   * @param {string} containerId - The container id supplied to this operation.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {number} quantity - The quantity supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  reportDeposit(containerId: string, itemId: string, quantity: number): void {
    if (this.snapshot().containers[containerId].vendor || quantity <= 0) return

    this.depositListeners.emit({ containerId, items: [{ itemId, quantity }] })
  }

  /**
   * Perform record deposit for InventoryLedger.
   * @param {string} containerId - The container id supplied to this operation.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {number} amount - Amount to apply to the operation.
   * @returns {void} Completes the operation without returning a value.
   */
  recordDeposit(containerId: string, itemId: string, amount: number): void {
    const stored = this.deposits.get(containerId) ?? new Map<string, number>()
    const quantity = Math.max(0, (stored.get(itemId) ?? 0) + amount)
    if (quantity) stored.set(itemId, quantity)
    else stored.delete(itemId)

    this.deposits.set(containerId, stored)
  }

  /**
   * Subscribe to loot.
   * @param {(pickup: LootPickup) => void} listener - Callback invoked when the observable value changes.
   * @returns {() => void} Callback that releases or performs the registered operation.
   */
  subscribeLoot = (listener: (pickup: LootPickup) => void): (() => void) => {
    return this.lootListeners.subscribe(listener)
  }

  /**
   * Subscribe to deposit.
   * @param {(deposit: LootPickup) => void} listener - Callback invoked when the observable value changes.
   * @returns {() => void} Callback that releases or performs the registered operation.
   */
  subscribeDeposit = (listener: (deposit: LootPickup) => void): (() => void) => {
    return this.depositListeners.subscribe(listener)
  }

  readonly lootListeners = new EventChannel<[LootPickup]>()

  readonly depositListeners = new EventChannel<[LootPickup]>()
}
