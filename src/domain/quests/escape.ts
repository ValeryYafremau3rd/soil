import type { ItemStack } from '../inventory/loot'
import type { QuestDefinition, QuestProgress } from './quests/types'
import { isQuestCompleted } from './quests/availability.ts'

/** Atomic inventory transaction and progress changes for either departure route. */
export interface EscapePlan {
  removals: readonly ItemStack[]
  grants: readonly ItemStack[]
  money: number
  progress: readonly QuestProgress[]
  finishedIds: readonly string[]
}

/**
 * Resolve one alternative ending without requiring the other route's objectives.
 * @param {readonly QuestDefinition[]} definitions - Current resolved quest definitions.
 * @param {readonly QuestProgress[]} progress - Current quest runs, including legacy key stages.
 * @param {'illegal' | 'official'} route - World exit used by the player.
 * @param {number} day - Day recorded for completed quests.
 * @returns {EscapePlan | null} All changes to commit, or null when prerequisites are missing.
 */
export function planEscape(
  definitions: readonly QuestDefinition[],
  progress: readonly QuestProgress[],
  route: 'illegal' | 'official',
  day: number,
): EscapePlan | null {
  const completed = (id: string) => isQuestCompleted(id, progress, definitions)
  const escape = definitions.find(quest => quest.id === 'way-out-of-town')
  const run = progress.find(entry => entry.questId === escape?.id)
  if (!escape || !run || run.failed || completed(escape.id)
    || !completed('prologue-last-night')) return null

  const official = definitions.find(quest => quest.id === 'prologue-government-exit')
  const permitRun = progress.find(entry => entry.questId === official?.id)
  if (route === 'official' && (!official || !permitRun || permitRun.failed
    || permitRun.stageIndex < official.stages.length - 1)) return null

  const finishedIds = [escape.id,
    ...(route === 'official' && official && !completed(official.id) ? [official.id] : [])]
  const finished = definitions.filter(quest => finishedIds.includes(quest.id))
  return {
    removals: route === 'official' ? [{ itemId: 'exit-permit', quantity: 1 }] : [],
    grants: finished.flatMap(quest => quest.reward?.items ?? []),
    money: finished.reduce((total, quest) => total + (quest.reward?.money ?? 0), 0),
    finishedIds,
    progress: progress.map(entry => finishedIds.includes(entry.questId)
      ? { ...entry, stageIndex: definitions.find(q => q.id === entry.questId)!.stages.length,
        completedStageIds: [], completedDay: day } : entry),
  }
}
