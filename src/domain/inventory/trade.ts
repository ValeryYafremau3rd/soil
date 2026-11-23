import type { InventoryItemDefinition } from './items'
import config from '../../content/skills.json' with { type: 'json' }
import { legendarySkill } from '../skills/effects.ts'

/**
 * Identify goods whose purchase and sale prices legendary Barter waives.
 * @param {InventoryItemDefinition} item - Authored goods being priced.
 * @param {number} barter - Current effective Barter skill, including carried bonuses.
 * @returns {boolean} Whether both transaction directions must use zero.
 */
export function hasFreeBarterPrice(item: InventoryItemDefinition, barter: number): boolean {
  const rules = config.legendary.barter

  return legendarySkill({ barter }, 'barter')
    && (rules.freeCategories.includes(item.category ?? '') || rules.freeItemIds.includes(item.id))
}

/**
 * Prices are per item. Round down before multiplying by the stack quantity.
 * @param {Pick<InventoryItemDefinition, "price">} item - The item supplied to this operation.
 * @param {boolean} selling - The selling supplied to this operation.
 * @param {{ buyPrice: number; sellPrice: number; }} modifiers - The modifiers supplied to this operation.
 * @param {boolean} understood - The understood supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function tradePrice(
  item: Pick<InventoryItemDefinition, 'price'>,
  selling = false,
  modifiers: {
    buyPrice: number
    sellPrice: number
  } = { buyPrice: 1, sellPrice: 0.5 },
  understood = true
): number {
  if (selling && !understood) return 1

  const price = item.price ?? 1
  const buy = Math.max(1, Math.ceil(Number((price * modifiers.buyPrice).toFixed(8))))

  return selling ? Math.max(1, Math.min(buy, Math.floor(Number((price * modifiers.sellPrice).toFixed(8))))) : buy
}
