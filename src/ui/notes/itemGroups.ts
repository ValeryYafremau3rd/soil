import type { EquipmentSlot, InventoryItemDefinition } from '../../domain/inventory/items'

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  ranged: 'Ranged weapon', melee: 'Melee weapon', tool: 'Tool', armor: 'Armor',
  shoes: 'Shoes', accessory: 'Accessory', amulet: 'Amulet', bag: 'Bag',
}

const TYPE_LABELS: Record<string, string> = {
  Food: 'Food', Drink: 'Drinks', Medical: 'Medicine', Weapon: 'Weapons',
  Ammunition: 'Ammunition', Tool: 'Tools', Book: 'Books', Document: 'Documents',
  Clothing: 'Clothing', Supply: 'Supplies', Material: 'Materials', Scrap: 'Scrap',
  Valuable: 'Valuables', Quest: 'Quest items',
}

/**
 * Equipped items belong to their slot, regardless of their authored item type.
 * @param {Pick<InventoryItemDefinition, "equipmentSlot" | "category">} item - The item supplied to this operation.
 * @returns {string} The resolved text value.
 */
export function itemGroup(item: Pick<InventoryItemDefinition, 'equipmentSlot' | 'category'>): string {
  const category = item.category ?? 'Other'

  return item.equipmentSlot ? `Equipment: ${SLOT_LABELS[item.equipmentSlot]}` : TYPE_LABELS[category] ?? category
}
