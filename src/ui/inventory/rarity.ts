import type { ItemDefinition } from '../../content/types'

/**
 * Perform inventory appearance.
 * @param {ItemDefinition} item - The item supplied to this operation.
 * @param {boolean} understood - The understood supplied to this operation.
 * @returns {"common" | "uncommon" | "rare" | "epic" | "legendary" | "unknown" | "plain" | "valuable"} The result described by the TypeScript return signature.
 */
export function inventoryAppearance(
  item: ItemDefinition,
  understood: boolean
) {
  if (!understood) return 'unknown'

  if (item.consumable || item.scrap || item.ammunition) return 'plain'

  if (item.bonus || item.bonuses?.length || item.damageResistance || item.fearResistance || item.stealthModifier || item.inventorySlots) return item.rarity

  return item.category === 'Valuable' ? 'valuable' : 'plain'
}
