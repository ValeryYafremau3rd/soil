import type { Character } from '../../skills/character'
import type { InventoryItemDefinition, ItemRarity } from '../../inventory/items'
import skillConfig from '../../../content/skills.json' with { type: 'json' }
import type { QuestDefinition } from './types'

/**
 * Cash rewards use current effective skills; item-only quests stay item-only.
 * @param {QuestDefinition} quest - The quest supplied to this operation.
 * @param {Partial<Skills>} skills - The skills supplied to this operation.
 * @returns {QuestDefinition} The result described by the TypeScript return signature.
 */
export function resolveQuestMoney(
  quest: QuestDefinition,
  skills: Partial<Character['skills']>
): QuestDefinition {
  if (!quest.reward?.money) return quest

  const money = Math.floor(Object.entries(skillConfig.questMoneyWeights).reduce((total, [skill, weight]) =>
    total + Math.max(0, skills[skill as keyof Character['skills']] ?? 0) * weight, 0))

  return { ...quest, reward: { ...quest.reward, money } }
}

/**
 * Resolve find requests from current authored item prices, never vendor/Barter sale prices.
 * @param {readonly QuestDefinition[]} quests - The quests supplied to this operation.
 * @param {readonly InventoryItemDefinition[]} items - Item stacks to inspect or transform.
 * @param {Readonly<Record<"common" | "uncommon" | "rare" | "epic" | "legendary", number>>} multipliers - The multipliers supplied to this operation.
 * @returns {QuestDefinition[]} The result described by the TypeScript return signature.
 */
export function resolveFindItemRewards(
  quests: readonly QuestDefinition[],
  items: readonly InventoryItemDefinition[],
  multipliers: Readonly<Record<ItemRarity, number>>
): QuestDefinition[] {
  return quests.map(quest => {
    if (!quest.findItem || quest.findItem === '$item') return quest

    const item = items.find(item => item.id === quest.findItem)
    if (!item || !item.price || !item.rarity) throw new Error(`Invalid find-item request: ${quest.id}`)

    return { ...quest, reward: { money: Math.ceil(item.price * multipliers[item.rarity]) } }
  })
}
