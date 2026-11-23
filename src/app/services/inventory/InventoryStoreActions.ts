import { swapItems, transferItem } from '../../../domain/inventory/loot.ts'
import { quantityOf } from '../../../domain/inventory/stacks.ts'
import { occupiedSlots } from '../../../domain/inventory/slotUsage.ts'
import type { InventoryTransferAccess } from './InventoryTransferAccess.ts'
type Access = Pick<InventoryTransferAccess,
  'snapshot' |
  'slotCost' |
  'notify' |
  'definitions' |
  'stackLimit' |
  'canFitInventory' |
  'getPrice' |
  'getCapacity' |
  'ledger' |
  'publish' |
  'onStatistic' |
  'onSold' |
  'canTake' |
  'equipReceived'
>

/**
 * Owns inventory store actions state and behavior.
 */
export class InventoryStoreActions {
  private readonly inventory: Access

  /**
   * Initialize the InventoryStoreActions instance and its collaborators.
   * @param {Access} inventory - Inventory capability used to read or transact items.
   * @returns {InventoryStoreActions} The initialized instance.
   */
  constructor(inventory: Access) {
    this.inventory = inventory
  }

  /**
   * Perform store item for InventoryStoreActions.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {number | undefined} slot - The slot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  storeItem = (
    itemId: string,
    slot?: number
  ): void => {
    const menu = this.inventory.snapshot.menu
    if (menu?.kind !== 'container') return

    const container = this.inventory.snapshot.containers[menu.containerId]
    if (container.lootOnly) {
      this.inventory.notify('Items cannot be stored in corpses.')

      return
    }

    if (container.vendor && this.inventory.definitions[itemId]?.saleable === false) {
      this.inventory.notify("You can't sell this item.")

      return
    }

    if (container.vendor && quantityOf(container.items, itemId) >= this.inventory.stackLimit(itemId)) {
      this.inventory.notify('Vendor already has a full stack of this item.')

      return
    }

    const result = transferItem(
      container.items,
      this.inventory.snapshot.items,
      itemId,
      Infinity,
      this.inventory.stackLimit,
      slot,
      container.vendor ? 1 : Infinity
    )
    if (result.remaining === this.inventory.snapshot.items) return

    if (!this.inventory.canFitInventory(result.remaining)) return

    const moved = quantityOf(this.inventory.snapshot.items, itemId) - quantityOf(result.remaining, itemId)
    const proceeds = container.vendor ? this.inventory.getPrice(itemId, true) * moved : 0
    if (!Number.isSafeInteger(this.inventory.snapshot.money + proceeds)) return

    let paidItems = result.remaining
    if (proceeds) {
      const payout = transferItem(
        paidItems,
        [{ itemId: 'money', quantity: proceeds }],
        'money',
        this.inventory.getCapacity(),
        this.inventory.stackLimit,
        undefined,
        Infinity,
        this.inventory.slotCost
      )
      if (payout.remaining.length) {
        this.inventory.notify('No free room for payment.')

        return
      }

      paidItems = payout.inventory
    }

    this.inventory.ledger.recordDeposit(
      container.id,
      itemId,
      quantityOf(this.inventory.snapshot.items, itemId) - quantityOf(result.remaining, itemId)
    )
    this.inventory.publish({
      ...this.inventory.snapshot,
      money: this.inventory.snapshot.money + proceeds,
      items: paidItems,
      containers: {
        ...this.inventory.snapshot.containers,
        [container.id]: { ...container, items: result.inventory },
      }
    })
    this.inventory.onStatistic('moneyEarned', proceeds)
    this.inventory.ledger.reportDeposit(container.id, itemId, moved)
    if (container.vendor) for (let n = 0;n < moved;n++) this.inventory.onSold()
  }

  /**
   * Perform swap items for InventoryStoreActions.
   * @param {string} inventoryItemId - The inventory item id supplied to this operation.
   * @param {string} containerItemId - The container item id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  swapItems = (
    inventoryItemId: string,
    containerItemId: string
  ): void => {
    const menu = this.inventory.snapshot.menu
    if (menu?.kind !== 'container') return

    const container = this.inventory.snapshot.containers[menu.containerId]
    if (container.lootOnly) {
      this.inventory.notify('Items cannot be stored in corpses.')

      return
    }

    if (container.vendor) return

    const outgoing = this.inventory.snapshot.items.findIndex(item => item.itemId === inventoryItemId)
    const incoming = container.items.find(item => item.itemId === containerItemId)
    if (outgoing < 0 || !incoming || this.inventory.canTake(container.id, incoming.itemId) !== true) return

    const remaining = this.inventory.snapshot.items.filter((_, index) => index !== outgoing)
    const capacity = this.inventory.getCapacity()
    if (occupiedSlots(remaining, this.inventory.slotCost) > capacity) {
      this.inventory.canFitInventory(remaining)

      return
    }

    const result = swapItems(
      this.inventory.snapshot.items,
      container.items,
      inventoryItemId,
      containerItemId,
      this.inventory.stackLimit,
      capacity,
      this.inventory.slotCost
    )
    if (result.inventory === this.inventory.snapshot.items) return

    if (!this.inventory.canFitInventory(result.inventory)) return

    const deposits = new Map(this.inventory.ledger.deposits.get(container.id))
    const depositedQuantity = this.inventory.snapshot.items[outgoing].quantity
    this.inventory.ledger.recordDeposit(
      container.id,
      containerItemId,
      -container.items.find(item => item.itemId === containerItemId)!.quantity
    )
    this.inventory.ledger.recordDeposit(
      container.id,
      inventoryItemId,
      this.inventory.snapshot.items.find(item => item.itemId === inventoryItemId)!.quantity
    )
    const received = this.inventory.equipReceived([incoming], this.inventory.snapshot.equipment)
    const acquired = received.items.reduce((total, item) => total + item.quantity, 0) < incoming.quantity
    const acquiredIndex = result.inventory.findIndex(stack => stack.itemId === incoming.itemId)
    const equippedItems = acquired ? result.inventory.flatMap((item, index) => {
      if (index !== acquiredIndex) return [item]

      return item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []
    }) : result.inventory
    this.inventory.publish({
      ...this.inventory.snapshot,
      equipment: received.equipment,
      items: equippedItems,
      containers: {
        ...this.inventory.snapshot.containers,
        [container.id]: { ...container, items: result.container },
      }
    })
    this.inventory.ledger.reportLoot(container, container.items, result.container, deposits)
    this.inventory.ledger.reportDeposit(container.id, inventoryItemId, depositedQuantity)
  }
}
