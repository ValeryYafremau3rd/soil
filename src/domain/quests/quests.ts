import type { ItemStack } from '../inventory/loot'
import type { QuestDefinition, QuestProgress, QuestStage } from './quests/types'

// Preserve the shared entry point while stage rules remain owned by this module.
export type {
  QuestAction, QuestStage, QuestParameters, QuestDestination,
  QuestDefinition, QuestProgress, CourierBoard,
} from './quests/types'
export { resolveQuestMoney, resolveFindItemRewards } from './quests/rewards.ts'
export {
  isQuestCompleted, npcTrust, isQuestAvailable, availableBoardQuests,
} from './quests/availability.ts'
export { resolveQuest } from './quests/templates.ts'

/**
 * Check whether quest items is present.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {readonly ItemStack[]} required - The required supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function hasQuestItems(
  items: readonly ItemStack[],
  required: readonly ItemStack[] = []
): boolean {
  const quantities = new Map<string, number>()

  for (const stack of required) quantities.set(stack.itemId, (quantities.get(stack.itemId) ?? 0) + stack.quantity)

  return [...quantities].every(([id, quantity]) => items.reduce((total, stack) => total + (stack.itemId === id ? stack.quantity : 0), 0) >= quantity)
}

/**
 * Check whether complete stage is allowed.
 * @param {QuestStage} stage - The stage supplied to this operation.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {object | undefined} source - Optional finite loot source for earlier collection credit.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function canCompleteStage(
  stage: QuestStage,
  items: readonly ItemStack[],
  source?: { items: readonly ItemStack[]; locked?: boolean }
): boolean {
  const collected = stage.collectedFrom && source && !source.locked
    && stage.requiredItems?.every(required =>
      !source.items.some(item => item.itemId === required.itemId && item.quantity > 0))

  return (collected || hasQuestItems(items, stage.requiredItems))
    && hasQuestItems(items, stage.removeItems)
    && selectQuestGroupItems(stage, items) !== null
}

/**
 * Select one carried unit per alternative group, without reusing a unit.
 * @param {QuestStage} stage - The stage supplied to this operation.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @returns {ItemStack[] | null} The result described by the TypeScript return signature.
 */
export function selectQuestGroupItems(
  stage: QuestStage,
  items: readonly ItemStack[]
): ItemStack[] | null {
  const remaining = items.map(stack => ({ ...stack }))
  const selected: ItemStack[] = []

  for (const group of stage.requiredItemGroups ?? []) {
    const stack = remaining.find(stack => stack.quantity > 0 && group.includes(stack.itemId))
    if (!stack) return null

    stack.quantity--
    selected.push({ itemId: stack.itemId, quantity: 1 })
  }

  return selected
}

/**
 * Consecutive stages in one group are available together until every objective is done.
 * @param {QuestDefinition} definition - The definition supplied to this operation.
 * @param {QuestProgress} progress - The progress supplied to this operation.
 * @returns {readonly QuestStage[]} The result described by the TypeScript return signature.
 */
export function activeQuestStages(
  definition: QuestDefinition,
  progress: QuestProgress
): readonly QuestStage[] {
  if (progress.failed) return []

  const first = definition.stages[progress.stageIndex]
  if (!first) return []

  let end = progress.stageIndex + 1
  if (first.parallelGroup) while (definition.stages[end]?.parallelGroup === first.parallelGroup) end++

  const stages = definition.stages.slice(progress.stageIndex, end)

  return stages.filter(stage => !progress.completedStageIds?.includes(stage.id))
}
