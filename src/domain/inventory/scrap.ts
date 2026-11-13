import config from '../../content/skills.json' with { type: 'json' }
import type { InventoryItemDefinition } from './items'
import type { ItemStack } from './loot'
import { legendarySkill } from '../skills/effects.ts'
import { rollLoot } from './loot.ts'

export function scrapChance(skill: number): number {
  const base = Math.min(config.scrapping.maxChance, config.scrapping.baseChance + Math.max(0, Number.isFinite(skill) ? skill : 0) * config.scrapping.chancePerPoint)
  return legendarySkill({ scraper: skill }, 'scraper') ? config.legendary.scrapping.itemChance : base
}

export function scrapReward(skill: number, definitions: Readonly<Record<string, InventoryItemDefinition>>, random: () => number): ItemStack | null {
  if (random() >= scrapChance(skill)) {
    if (!legendarySkill({ scraper: skill }, 'scraper')) return null
    const fallback = config.legendary.scrapping.fallbackReward
    return { itemId: fallback.itemId, quantity: fallback.minQuantity + Math.floor(random() * (fallback.maxQuantity - fallback.minQuantity + 1)) }
  }
  let rewards = config.scrapping.rewards
  if (legendarySkill({ scraper: skill }, 'scraper')) {
    rewards = rewards.filter(item => !definitions[item.itemId]?.ammunition)
  }
  const [rolled] = rollLoot({ itemIds: rewards.map(item => item.itemId), minItems: 1, maxItems: 1,
    weights: Object.fromEntries(rewards.map(item => [item.itemId, config.scrapping.rarityWeights[definitions[item.itemId]?.rarity ?? 'common']])) }, random)
  return rewards.find(item => item.itemId === rolled.itemId) ?? null
}

