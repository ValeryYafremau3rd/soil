import { migrateMotherJournal } from '../../persistence/migrateMotherJournal.ts'
import skillConfig from '../../../content/skills.json' with { type: 'json' }
import { migrateReadingInventory } from '../../persistence/migrateReading.ts'
import { deliveryItemId, EQUIPMENT_SLOTS } from '../../../domain/inventory/items.ts'
import type { ItemStack } from '../../../domain/inventory/loot'
import { inventoryCapacity, normalizeStacks, transferItem } from '../../../domain/inventory/loot.ts'
import { quantityOf } from '../../../domain/inventory/stacks.ts'
import type { SavedInventory } from '../../contracts/save'
import type { InventoryAccess } from './InventoryAccess.ts'
import type { InventoryLedger } from './InventoryLedger.ts'
/**
 * Narrow inventory persistence capabilities injected into a collaborating service.
 */
interface InventoryPersistenceAccess extends InventoryAccess {
  readonly ledger: InventoryLedger
}

/**
 * Owns inventory persistence state and behavior.
 */
export class InventoryPersistence {
  private readonly inventory: InventoryPersistenceAccess

  /**
   * Initialize the InventoryPersistence instance and its collaborators.
   * @param {InventoryPersistenceAccess} inventory - Inventory capability used to read or transact items.
   * @returns {InventoryPersistence} The initialized instance.
   */
  constructor(inventory: InventoryPersistenceAccess) {
    this.inventory = inventory
  }

  /**
   * Save state.
   * @returns {SavedInventory} The result described by the TypeScript return signature.
   */
  saveState = (): SavedInventory => structuredClone({
    motherJournalVersion: 1,
    barterAmmoVersion: 1,
    lootedCaches: [...this.inventory.ledger.lootedCaches],
    deliveryVersion: 2,
    ...(this.inventory.ledger.legendaryBarterStock ? { legendaryBarterStock: this.inventory.ledger.legendaryBarterStock } : {}),
    currencyInInventory: true,
    slotlessMoney: this.inventory.slotCost('money') === 0
      || this.inventory.snapshot.items.length > inventoryCapacity(
        this.inventory.snapshot.equipment, this.inventory.definitions
      ),
    readBooks: this.inventory.snapshot.readBooks,
    equipment: this.inventory.snapshot.equipment,
    items: this.inventory.snapshot.items,
    money: this.inventory.snapshot.money,
    keyItems: this.inventory.snapshot.keyItems,
    containers: Object.fromEntries(Object.entries(this.inventory.snapshot.containers).filter(([id]) => !this.inventory.ledger.temporaryContainers.has(id)).map(([id, container]) => [id, { items: container.items, locked: container.locked ?? false }])),
    deposits: Object.fromEntries([...this.inventory.ledger.deposits].filter(([id]) => !this.inventory.ledger.temporaryContainers.has(id)).map(([id, items]) => [id, [...items].map(([itemId, quantity]) => ({ itemId, quantity }))])),
  })

  /**
   * Restore state.
   * @param {SavedInventory} saved - The saved supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  restoreState = (saved: SavedInventory): void => {
    saved = migrateReadingInventory(saved)
    if (this.inventory.definitions['milena-mother-journal']) saved = migrateMotherJournal(saved)

    this.inventory.ledger.lootedCaches.clear()

    for (const id of saved.lootedCaches ?? []) this.inventory.ledger.lootedCaches.add(id)

    /**
     * Perform migrate.
     * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
     * @returns {{ itemId: string; quantity: number; }[]} The result described by the TypeScript return signature.
     */
    const migrate = (items: readonly ItemStack[]) => items.map(item => ({ ...item, itemId: deliveryItemId(item.itemId) }))
    saved = {
      ...saved,
      items: migrate(saved.items),
      containers: Object.fromEntries(Object.entries(saved.containers).map(([id, c]) => [id, { ...c, items: migrate(c.items) }])),
      deposits: Object.fromEntries(Object.entries(saved.deposits).map(([id, items]) => [id, migrate(items)]))
    }

    const previousArmor = saved.equipment?.armor
    if (previousArmor && this.inventory.definitions[previousArmor]?.equipmentSlot === 'shoes' && !saved.equipment?.shoes) {
      const equipment = { ...saved.equipment, shoes: previousArmor }
      delete equipment.armor
      saved = { ...saved, equipment }
    }

    const previousTool = saved.equipment?.tool
    if (previousTool && this.inventory.definitions[previousTool] && !this.inventory.definitions[previousTool].equipmentSlot) {
      const equipment = { ...saved.equipment }
      delete equipment.tool
      saved = { ...saved, equipment, items: [...saved.items, { itemId: previousTool, quantity: 1 }] }
    }

    for (const [slot, id] of Object.entries(saved.equipment ?? {})) {
      if (!EQUIPMENT_SLOTS.includes(slot as typeof EQUIPMENT_SLOTS[number]) || this.inventory.definitions[id]?.equipmentSlot !== slot) throw new Error('Invalid saved equipment')
    }

    /**
     * Split historical consumable stacks that exceed their current authored limit.
     * @param {readonly ItemStack[]} items - Saved stacks, preserving their indexed order.
     * @returns {ItemStack[]} Stacks within current limits without losing saved quantities.
     */
    const splitBottles = (items: readonly ItemStack[]): ItemStack[] => items.flatMap(stack => {
      const definition = this.inventory.definitions[stack.itemId]

      return stack.quantity > (definition?.maxStack ?? 1)
        && stack.quantity <= (stack.itemId === 'shotgun-shells' ? 6 : 5)
        && definition?.consumable
        && (!definition.scrap || stack.itemId === 'shotgun-shells')
        ? normalizeStacks([stack], this.inventory.stackLimit) : [stack]
    })
    let restoredItems = splitBottles(structuredClone(saved.items))
    if (saved.money && !saved.currencyInInventory) {
      const migrated = transferItem(
        restoredItems,
        [{ itemId: 'money', quantity: saved.money }],
        'money',
        inventoryCapacity(saved.equipment ?? {}, this.inventory.definitions),
        this.inventory.stackLimit
      )
      if (migrated.remaining.length) throw new Error('No inventory room for saved Thalers.')

      restoredItems = [...migrated.inventory]
    }

    const occupied = restoredItems.filter(item => !(saved.slotlessMoney
      || this.inventory.slotCost('money') === 0) || item.itemId !== 'money').length
    if (occupied > inventoryCapacity(saved.equipment ?? {}, this.inventory.definitions)) {
      throw new Error('Saved inventory exceeds equipped bag capacity')
    }

    this.inventory.ledger.legendaryBarterStock = saved.legendaryBarterStock ? structuredClone(saved.legendaryBarterStock) : undefined
    this.inventory.ledger.deposits.clear()

    for (const [id, items] of Object.entries(saved.deposits)) this.inventory.ledger.deposits.set(
      id,
      new Map(items.map(item => [item.itemId, item.quantity]))
    )

    this.inventory.publish({
      readBooks: [...saved.readBooks ?? []],
      equipment: saved.equipment ?? {},
      menu: null,
      money: saved.money,
      items: restoredItems,
      keyItems: [...saved.keyItems ?? []],
      containers: Object.fromEntries(Object.entries(this.inventory.snapshot.containers).filter(([id]) => !this.inventory.ledger.temporaryContainers.has(id)).map(([id, container]) => [
        id,
        {
          ...container,
          items: splitBottles(structuredClone(saved.containers[id]?.items ?? container.items)),
          locked: saved.containers[id]?.locked ?? container.locked
        }
      ])),
    })
    if (!saved.barterAmmoVersion) {
      const ammoId = skillConfig.legendary.barter.ammunition.itemId
      const containers = { ...this.inventory.snapshot.containers }

      for (const [id, container] of Object.entries(containers)) {
        if (!container.vendor) continue

        const deposited = this.inventory.ledger.deposits.get(id)?.get(ammoId) ?? 0
        const remaining = Math.max(0, quantityOf(container.items, ammoId) - deposited)
        if (id === skillConfig.legendary.barter.vendorId && this.inventory.ledger.legendaryBarterStock) {
          this.inventory.ledger.legendaryBarterStock = {
            ...this.inventory.ledger.legendaryBarterStock,
            items: [
              ...this.inventory.ledger.legendaryBarterStock.items.filter(item => item.itemId !== ammoId),
              ...(remaining ? [{ itemId: ammoId, quantity: remaining }] : []),
            ]
          }
          if (this.inventory.ledger.legendaryBarterStock.visible) continue
        }

        containers[id] = {
          ...container,
          items: container.items.filter(item => item.itemId !== ammoId).concat(deposited ? [{ itemId: ammoId, quantity: deposited }] : [])
        }
      }

      this.inventory.publish({ ...this.inventory.snapshot, containers })
    }

    this.inventory.ledger.temporaryContainers.clear()
  }
}
