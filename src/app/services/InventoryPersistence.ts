import skillConfig from '../../content/skills.json' with { type: 'json' }
import { deliveryItemId,EQUIPMENT_SLOTS } from '../../domain/inventory/items.ts'
import type { ItemStack } from '../../domain/inventory/loot'
import { inventoryCapacity,normalizeStacks,transferItem } from '../../domain/inventory/loot.ts'
import { quantityOf } from '../../domain/inventory/stacks.ts'
import type { SavedInventory } from '../contracts/save'
import type { InventoryAccess } from './InventoryAccess.ts'
import type { InventoryLedger } from './InventoryLedger.ts'
interface InventoryPersistenceAccess extends InventoryAccess { readonly ledger: InventoryLedger;  }
export class InventoryPersistence {
private readonly inventory: InventoryPersistenceAccess
constructor(inventory: InventoryPersistenceAccess) { this.inventory = inventory }
saveState = (): SavedInventory => structuredClone({ barterAmmoVersion: 1, lootedCaches: [...this.inventory.ledger.lootedCaches], deliveryVersion: 2, ...(this.inventory.ledger.legendaryBarterStock ? { legendaryBarterStock: this.inventory.ledger.legendaryBarterStock } : {}), currencyInInventory: true, equipment: this.inventory.snapshot.equipment, items: this.inventory.snapshot.items, money: this.inventory.snapshot.money, keyItems: this.inventory.snapshot.keyItems,
    containers: Object.fromEntries(Object.entries(this.inventory.snapshot.containers).filter(([id]) => !this.inventory.ledger.temporaryContainers.has(id)).map(([id, container]) => [id, { items: container.items, locked: container.locked ?? false }])),
    deposits: Object.fromEntries([...this.inventory.ledger.deposits].filter(([id]) => !this.inventory.ledger.temporaryContainers.has(id)).map(([id, items]) => [id, [...items].map(([itemId, quantity]) => ({ itemId, quantity }))])),
  })

restoreState = (saved: SavedInventory): void => {
    this.inventory.ledger.lootedCaches.clear()
    for (const id of saved.lootedCaches ?? []) this.inventory.ledger.lootedCaches.add(id)
    const migrate = (items: readonly ItemStack[]) => items.map(item => ({ ...item, itemId: deliveryItemId(item.itemId) }))
    saved = { ...saved, items: migrate(saved.items),
      containers: Object.fromEntries(Object.entries(saved.containers).map(([id, c]) => [id, { ...c, items: migrate(c.items) }])),
      deposits: Object.fromEntries(Object.entries(saved.deposits).map(([id, items]) => [id, migrate(items)])) }

    const previousArmor = saved.equipment?.armor
    if (previousArmor && this.inventory.definitions[previousArmor]?.equipmentSlot === 'shoes' && !saved.equipment?.shoes) {
      const equipment = { ...saved.equipment, shoes: previousArmor }
      delete equipment.armor
      saved = { ...saved, equipment }
    }
    const previousTool = saved.equipment?.tool
    if (previousTool && this.inventory.definitions[previousTool] && !this.inventory.definitions[previousTool].equipmentSlot && !this.inventory.definitions[previousTool].consumable) {
      const equipment = { ...saved.equipment }
      delete equipment.tool
      saved = { ...saved, equipment, items: [...saved.items, { itemId: previousTool, quantity: 1 }] }
    }
    for (const [slot, id] of Object.entries(saved.equipment ?? {})) {
      if (!EQUIPMENT_SLOTS.includes(slot as typeof EQUIPMENT_SLOTS[number]) || this.inventory.definitions[id]?.equipmentSlot !== slot) throw new Error('Invalid saved equipment')
    }
    const splitBottles = (items: readonly ItemStack[]): ItemStack[] => items.flatMap(stack => {
      const definition = this.inventory.definitions[stack.itemId]
      return stack.quantity > 1 && stack.quantity <= (stack.itemId === 'shotgun-shells' ? 6 : 5) && definition?.consumable && (!definition.scrap || stack.itemId === 'shotgun-shells') && definition.maxStack === 1
        ? normalizeStacks([stack], this.inventory.stackLimit) : [stack]
    })
    let restoredItems = splitBottles(structuredClone(saved.items))
    if (saved.money && !saved.currencyInInventory) {
      const migrated = transferItem(restoredItems, [{ itemId: 'money', quantity: saved.money }], 'money', inventoryCapacity(saved.equipment ?? {}, this.inventory.definitions), this.inventory.stackLimit)
      if (migrated.remaining.length) throw new Error('No inventory room for saved Thalers.')
      restoredItems = [...migrated.inventory]
    }
    if (restoredItems.length > inventoryCapacity(saved.equipment ?? {}, this.inventory.definitions)) throw new Error("Saved inventory exceeds equipped bag capacity")
    this.inventory.ledger.legendaryBarterStock = saved.legendaryBarterStock ? structuredClone(saved.legendaryBarterStock) : undefined
    this.inventory.ledger.deposits.clear()
    for (const [id, items] of Object.entries(saved.deposits)) this.inventory.ledger.deposits.set(id, new Map(items.map(item => [item.itemId, item.quantity])))
    this.inventory.publish({ equipment: saved.equipment ?? {}, menu: null, money: saved.money, items: restoredItems, keyItems: [...saved.keyItems ?? []],
      containers: Object.fromEntries(Object.entries(this.inventory.snapshot.containers).filter(([id]) => !this.inventory.ledger.temporaryContainers.has(id)).map(([id, container]) => [id,
        { ...container, items: splitBottles(structuredClone(saved.containers[id]?.items ?? container.items)), locked: saved.containers[id]?.locked ?? container.locked }])),
    })
    if (!saved.barterAmmoVersion) {
      const ammoId = skillConfig.legendary.barter.ammunition.itemId
      const containers = { ...this.inventory.snapshot.containers }
      for (const [id, container] of Object.entries(containers)) {
        if (!container.vendor) continue
        const deposited = this.inventory.ledger.deposits.get(id)?.get(ammoId) ?? 0
        const remaining = Math.max(0, quantityOf(container.items, ammoId) - deposited)
        if (id === skillConfig.legendary.barter.vendorId && this.inventory.ledger.legendaryBarterStock) {
          this.inventory.ledger.legendaryBarterStock = { ...this.inventory.ledger.legendaryBarterStock, items: [
            ...this.inventory.ledger.legendaryBarterStock.items.filter(item => item.itemId !== ammoId),
            ...(remaining ? [{ itemId: ammoId, quantity: remaining }] : []),
          ] }
          if (this.inventory.ledger.legendaryBarterStock.visible) continue
        }
        containers[id] = { ...container, items: container.items.filter(item => item.itemId !== ammoId).concat(deposited ? [{ itemId: ammoId, quantity: deposited }] : []) }
      }
      this.inventory.publish({ ...this.inventory.snapshot, containers })
    }
    this.inventory.ledger.temporaryContainers.clear()
  }
}
