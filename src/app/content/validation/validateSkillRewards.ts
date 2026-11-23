import { ITEM_RARITIES } from '../../../domain/inventory/items.ts'
import { SKILL_LABELS } from '../../../domain/skills/character.ts'
import { requireCondition, unique } from './assertions.ts'
import type { ContentContext } from './context.ts'

/**
 * Validate skill rewards against the supported rules.
 * @param {object} context - The context supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateSkillRewards(context: ContentContext) {
  const { dialogues, items, findRewards, legendary, scrapping } = context
  requireCondition(
    legendary.barter.freeItemIds.every(id => items.some(item => item.id === id)),
    'skills.json.legendary.barter.freeItemIds: unknown item'
  )
  const vehicleSearch = (context.input.skills as {
    vehicleSearch: {
      parts: {
        itemId: string
      }[]
      valuables: {
        itemId: string
      }[]
    }
  }).vehicleSearch

  for (const reward of [...vehicleSearch.parts, ...vehicleSearch.valuables]) {
    requireCondition(
      items.some(item => item.id === reward.itemId),
      'skills.json.vehicleSearch: unknown reward item'
    )
  }

  requireCondition(
    ITEM_RARITIES.every((rarity, index) => !index || findRewards[ITEM_RARITIES[index - 1]] <= findRewards[rarity]),
    'daytime.json.findItemRewardMultipliers: rewards must increase with rarity'
  )
  requireCondition(
    items.some(item => item.id === legendary.barter.ammunition.itemId && item.ammunition && legendary.barter.ammunition.quantity <= (item.maxStack ?? 1)),
    'skills.json.legendary.barter.ammunition: requires existing ammunition within its stack limit'
  )
  requireCondition(
    legendary.barter.minItems <= legendary.barter.maxItems,
    'skills.json.legendary.barter: minItems exceeds maxItems'
  )
  unique(legendary.perks.map(perk => perk.skill), 'skills.json.legendary.perks')
  requireCondition(
    Object.keys(SKILL_LABELS).every(skill => legendary.perks.some(perk => perk.skill === skill)),
    'skills.json.legendary.perks: requires every skill'
  )
  requireCondition(
    items.some(item => item.id === legendary.scrapping.fallbackReward.itemId && item.ammunition && !item.scrap && item.randomLoot !== false),
    'skills.json.legendary.scrapping.fallbackReward: requires useful ammunition'
  )
  requireCondition(
    legendary.scrapping.fallbackReward.minQuantity <= legendary.scrapping.fallbackReward.maxQuantity,
    'skills.json.legendary.scrapping.fallbackReward: minQuantity exceeds maxQuantity'
  )
  requireCondition(
    Object.values(dialogues).some(dialogue => [dialogue.barter, ...dialogue.barters ?? []].some(barter => barter?.id === legendary.barter.vendorId)),
    'skills.json.legendary.barter: unknown vendor'
  )
  requireCondition(
    scrapping.baseChance <= scrapping.maxChance,
    'skills.json.scrapping: baseChance exceeds maxChance'
  )
  unique(scrapping.rewards.map(reward => reward.itemId), 'skills.json.scrapping.rewards')

  for (const reward of scrapping.rewards) requireCondition(
    items.some(item => item.id === reward.itemId && !item.scrap
      && (item.randomLoot !== false || Boolean(item.equipmentSlot))),
    `skills.json.scrapping.rewards: requires useful existing item "${reward.itemId}"`
  )
}
