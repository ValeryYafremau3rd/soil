import skillConfig from '../../../content/skills.json' with { type: 'json' }
import { inventoryCapacity } from '../../../domain/inventory/loot.ts'
import { quantityOf, withoutItems } from '../../../domain/inventory/stacks.ts'
import { occupiedSlots } from '../../../domain/inventory/slotUsage.ts'
import type { InventoryTransferAccess } from './InventoryTransferAccess.ts'
type Access = Pick<InventoryTransferAccess,
  'snapshot' |
  'slotCost' |
  'canTake' |
  'notify' |
  'definitions' |
  'attachKeys' |
  'getCapacity' |
  'ledger' |
  'publish' |
  'getPrice' |
  'receiveItem' |
  'onStatistic' |
  'onPurchased'
>

/**
 * Owns inventory take actions state and behavior.
 */
export class InventoryPickupActions {
  private readonly inventory: Access

  /**
   * Initialize the InventoryPickupActions instance and its collaborators.
   * @param {Access} inventory - Inventory capability used to read or transact items.
   * @returns {InventoryPickupActions} The initialized instance.
   */
  constructor(inventory: Access) {
    this.inventory = inventory
  }

  /**
   * Perform take item for InventoryPickupActions.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {number | undefined} slot - The slot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  takeItem = (
    itemId: string,
    slot?: number
  ): void => {
    const menu = this.inventory.snapshot.menu
    if (menu?.kind !== 'container') return

    const container = this.inventory.snapshot.containers[menu.containerId]
    const source = container.items[slot ?? container.items.findIndex(item => item.itemId === itemId)]
    if (!source || source.itemId !== itemId) return

    const access = this.inventory.canTake(container.id, itemId)
    if (access !== true) {
      this.inventory.notify(typeof access === 'string' ? access : 'This shipment is not for your current job.')

      return
    }

    if (this.inventory.definitions[itemId]?.attachToKeyRing && !container.vendor) {
      const attached = this.inventory.attachKeys([...this.inventory.snapshot.items, source])
      if (occupiedSlots(attached.items, this.inventory.slotCost) > this.inventory.getCapacity()) {
        this.inventory.notify('No free room in inventory.')

        return
      }

      const sourceSlot = slot ?? container.items.indexOf(source)
      const remaining = container.items.filter((_, index) => index !== sourceSlot)
      const deposits = new Map(this.inventory.ledger.deposits.get(container.id))
      this.inventory.ledger.recordDeposit(container.id, itemId, -source.quantity)
      this.inventory.publish({
        ...this.inventory.snapshot,
        ...attached,
        containers: {
          ...this.inventory.snapshot.containers,
          [container.id]: { ...container, items: remaining }
        }
      })
      this.inventory.ledger.reportLoot(container, container.items, remaining, deposits)

      return
    }

    const unitCost = container.vendor ? this.inventory.getPrice(itemId) : 0
    if (unitCost > this.inventory.snapshot.money) {
      this.inventory.notify('Not enough Thalers.')

      return
    }

    const paidItems = unitCost ? withoutItems(this.inventory.snapshot.items, [{ itemId: 'money', quantity: unitCost }])! : this.inventory.snapshot.items
    const result = this.inventory.receiveItem(
      paidItems,
      container.items,
      itemId,
      this.inventory.snapshot.equipment,
      slot ?? container.items.indexOf(source),
      container.vendor ? 1 : Infinity
    )
    if (result.remaining === container.items) {
      if (source?.itemId === itemId) this.inventory.notify('No free room in inventory.')

      return
    }

    const moved = quantityOf(container.items, itemId) - quantityOf(result.remaining, itemId)
    const cost = container.vendor ? this.inventory.getPrice(itemId) * moved : 0
    if (cost > this.inventory.snapshot.money) {
      this.inventory.notify('Not enough Thalers.')

      return
    }
    // Identical copies are interchangeable; withdrawals use deposited quantities first.
    const deposits = new Map(this.inventory.ledger.deposits.get(container.id))
    this.inventory.ledger.recordDeposit(
      container.id,
      itemId,
      -(quantityOf(container.items, itemId) - quantityOf(result.remaining, itemId))
    )
    if (container.id === skillConfig.legendary.barter.vendorId && this.inventory.ledger.legendaryBarterStock?.visible) {
      this.inventory.ledger.legendaryBarterStock = {
        ...this.inventory.ledger.legendaryBarterStock,
        items: this.inventory.ledger.legendaryBarterStock.items.map(item => ({
          ...item,
          quantity: Math.max(
            0,
            quantityOf(result.remaining, item.itemId) - (this.inventory.ledger.deposits.get(container.id)?.get(item.itemId) ?? 0)
          ),
        })).filter(item => item.quantity > 0)
      }
    }

    this.inventory.publish({
      ...this.inventory.snapshot,
      equipment: result.equipment,
      money: this.inventory.snapshot.money - cost,
      items: result.inventory,
      containers: {
        ...this.inventory.snapshot.containers,
        [container.id]: { ...container, items: result.remaining },
      }
    })
    if (container.vendor) {
      this.inventory.onStatistic('moneySpent', cost)
      this.inventory.onStatistic('itemsBought', moved)
    }

    if (container.vendor) this.inventory.onPurchased?.(itemId)

    this.inventory.ledger.reportLoot(container, container.items, result.remaining, deposits)
  }

  /**
   * Perform take all for InventoryPickupActions.
   * @returns {void} Completes the operation without returning a value.
   */
  takeAll = (): void => {
    const menu = this.inventory.snapshot.menu
    if (menu?.kind !== 'container') return

    const container = this.inventory.snapshot.containers[menu.containerId]
    if (container.vendor) return

    if (!container.items.length) return

    let items = this.inventory.snapshot.items
    let remaining = container.items
    let keyItems = this.inventory.snapshot.keyItems
    let equipment = this.inventory.snapshot.equipment

    for (let slot = 0;slot < remaining.length;) {
      const item = remaining[slot]
      if (this.inventory.canTake(container.id, item.itemId) !== true) {
        slot++
        continue
      }

      if (this.inventory.definitions[item.itemId]?.attachToKeyRing) {
        const attached = this.inventory.attachKeys([...items, item], keyItems)
        if (occupiedSlots(attached.items, this.inventory.slotCost)
          <= inventoryCapacity(equipment, this.inventory.definitions)) {
          items = attached.items
          keyItems = attached.keyItems
          remaining = remaining.filter((_, index) => index !== slot)
          continue
        }
      }

      const result = this.inventory.receiveItem(items, remaining, item.itemId, equipment, slot)
      equipment = result.equipment
      items = result.inventory
      if (result.remaining.length === remaining.length) slot++

      remaining = result.remaining
    }
    if (items === this.inventory.snapshot.items && remaining === container.items) {
      this.inventory.notify('No free room in inventory.')

      return
    }

    const deposits = new Map(this.inventory.ledger.deposits.get(container.id))

    for (const itemId of new Set(container.items.map(item => item.itemId))) {
      this.inventory.ledger.recordDeposit(
        container.id,
        itemId,
        -(quantityOf(container.items, itemId) - quantityOf(remaining, itemId))
      )
    }

    this.inventory.publish({
      ...this.inventory.snapshot,
      items,
      equipment,
      keyItems,
      containers: {
        ...this.inventory.snapshot.containers,
        [container.id]: { ...container, items: remaining },
      }
    })
    this.inventory.ledger.reportLoot(container, container.items, remaining, deposits)
  }
}
