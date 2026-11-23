import type { ItemStack } from '../inventory/loot'
import type { QuestDefinition, QuestProgress } from './quests/types'
import { hasQuestItems } from './quests.ts'

/**
 * Recognize a key obtained before testimony without fabricating either NPC's clue.
 * @param {readonly QuestProgress[]} progress - Current quest progress, including partial clues.
 * @param {readonly QuestDefinition[]} definitions - Authored main-quest stage identifiers.
 * @param {readonly ItemStack[]} items - Carried items available after reaching Center.
 * @returns {readonly QuestProgress[]} Original progress or the recovered-key objective.
 */
export function recognizeEscapeKey(
  progress: readonly QuestProgress[],
  definitions: readonly QuestDefinition[],
  items: readonly ItemStack[]
): readonly QuestProgress[] {
  const quest = definitions.find(quest => quest.id === 'way-out-of-town')
  const run = progress.find(entry => entry.questId === quest?.id)
  const key = quest?.stages.find(stage => stage.id === 'find-a-clue')
  const recovered = quest?.stages.findIndex(stage => stage.id === 'strange-key') ?? -1
  if (!run || run.failed || run.stageIndex === 0 || run.stageIndex >= recovered
    || !key?.requiredItems?.length || !hasQuestItems(items, key.requiredItems)) return progress

  return progress.map(entry => entry === run
    ? { ...entry, stageIndex: recovered, completedStageIds: [] } : entry)
}
