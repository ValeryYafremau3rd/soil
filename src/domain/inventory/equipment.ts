import type { Equipment,InventoryItemDefinition } from './items'
import type { ItemStack } from './loot'
import { inventoryCapacity,transferItem } from './loot.ts'
export interface EquipmentAccess {
 definitions: Readonly<Record<string,InventoryItemDefinition>>
 stackLimit(id:string):number
 canEquip(definition:InventoryItemDefinition):boolean
}

export function equipReceived(items: readonly ItemStack[], current: Equipment, access: EquipmentAccess) {
    const equipment = { ...current }
    const remaining = items.flatMap(item => {
      const definition = access.definitions[item.itemId]
      const slot = definition?.equipmentSlot
      if (!slot || equipment[slot] || !access.canEquip(definition)) return [item]
      equipment[slot] = item.itemId
      return item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []
    })
    return { equipment, items: remaining }
  }

export function receiveItem(items: readonly ItemStack[], source: readonly ItemStack[], itemId: string,
    equipment: Equipment, slot: number, maxQuantity = Infinity, access: EquipmentAccess) {
    const item = source[slot]
    if (!item || item.itemId !== itemId) return { inventory: items, remaining: source, equipment }
    const received = equipReceived([{ ...item, quantity: Math.min(item.quantity, maxQuantity) }], equipment, access)
    const equipped = Object.keys(received.equipment).length > Object.keys(equipment).length
    if (!equipped) return { ...transferItem(items, source, itemId, inventoryCapacity(equipment, access.definitions), access.stackLimit, slot, maxQuantity), equipment }
    const remaining = item.quantity > 1 ? source.map((stack, index) => index === slot ? { ...stack, quantity: stack.quantity - 1 } : stack)
      : source.filter((_, index) => index !== slot)
    const result = maxQuantity > 1 && item.quantity > 1
      ? transferItem(items, remaining, itemId, inventoryCapacity(received.equipment, access.definitions), access.stackLimit, slot, maxQuantity - 1)
      : { inventory: items, remaining }
    return { ...result, equipment: received.equipment }
  }
