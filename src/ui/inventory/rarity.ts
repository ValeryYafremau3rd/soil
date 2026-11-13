import type { ItemDefinition } from '../../content/types'
export function inventoryAppearance(item: ItemDefinition, understood: boolean) {
  if (!understood) return 'unknown'
  if (item.consumable || item.scrap || item.ammunition) return 'plain'
  if (item.bonus || item.bonuses?.length || item.damageResistance || item.fearResistance || item.stealthModifier || item.inventorySlots) return item.rarity
  return item.category === 'Valuable' ? 'valuable' : 'plain'
}
