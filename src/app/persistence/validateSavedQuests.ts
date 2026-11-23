import { DAYTIME_CONFIG } from '../../content/daytime.ts'
import { isQuestCompleted } from '../../domain/quests/quests.ts'
import type { SaveGame } from '../contracts/save'
import { checkSave as check } from './checkSave.ts'
import type { SaveReferences } from './saveReferences.ts'
import { validateLegacyStoryPrerequisites } from './migrateStoryPrerequisites.ts'

/**
 * Validate saved quests against the supported rules.
 * @param {SaveGame} save - The save supplied to this operation.
 * @param {SaveReferences} references - The references supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateSavedQuests(
  save: SaveGame,
  references: SaveReferences
): void {
  validateLegacyStoryPrerequisites(save)
  /**
   * Validate parameters against the supported rules.
   * @param {string} questId - The quest id supplied to this operation.
   * @param {QuestParameters | undefined} parameters - The parameters supplied to this operation.
   * @param {boolean} offer - The offer supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const validateParameters = (
    questId: string,
    parameters: import('../../domain/quests/quests').QuestParameters | undefined,
    offer = false
  ): void => {
    const definition = references.quests.find(quest => quest.id === questId)
    if (!definition?.destinations) {
      check(!parameters)

      return
    }

    check(parameters && definition.destinations.some(destination => destination.id === parameters.sourceId)
      && definition.destinations.some(destination => destination.id === parameters.destinationId)
      && (definition.findItem || parameters.sourceId !== parameters.destinationId))
    if (definition.findItem) {
      const item = definition.findItemOptions?.find(item => item.id === parameters!.itemId)
      check(item && (!offer || (item.price ?? Infinity) <= DAYTIME_CONFIG.findItemMaxPrice))
    } else check(!parameters!.itemId)
  }

  for (const entry of save.quests) validateParameters(entry.questId, entry.parameters)

  for (const board of [save.courierBoard, save.npcJobs]) if (board) {
    for (const id of board.offeredQuestIds) validateParameters(id, board.parameters?.[id], true)

    check(Object.keys(board.parameters ?? {}).every(id => board.offeredQuestIds.includes(id)))
  }

  check(new Set(save.quests.map(quest => quest.questId)).size === save.quests.length)

  for (const quest of save.quests) {
    const definition = references.quests.find(candidate => candidate.id === quest.questId)
    check(definition && quest.stageIndex <= definition.stages.length)
    if (quest.completedDay !== undefined) {
      check(quest.completedDay <= save.daytime.day
        && quest.stageIndex === definition!.stages.length && !quest.failed)
    }
    if (quest.completedStageIds?.length) {
      const group = definition!.stages[quest.stageIndex]?.parallelGroup
      check(group && new Set(quest.completedStageIds).size === quest.completedStageIds.length)
      check(quest.completedStageIds.every(id => definition!.stages.slice(quest.stageIndex).some(stage => stage.id === id && stage.parallelGroup === group)))
      check(definition!.stages.slice(quest.stageIndex).some(stage => stage.parallelGroup === group && !quest.completedStageIds!.includes(stage.id)))
    }

    if (quest.deadline !== undefined || quest.failed !== undefined) {
      check(definition?.retryStage !== undefined || definition?.repeatable && definition.deliveryKind)
      check(!quest.failed || quest.deadline !== undefined && quest.stageIndex < definition!.stages.length)
    }

    for (const id of definition?.prerequisites ?? []) check(
      isQuestCompleted(id, save.quests, references.quests)
      || save.legacyQuestPrerequisites?.[quest.questId]?.includes(id))
  }

  for (const kind of ['courier', 'smuggler']) check(save.quests.filter(entry => {
    const definition = references.quests.find(quest => quest.id === entry.questId)

    return definition?.deliveryKind === kind && !entry.failed && entry.stageIndex < definition.stages.length
  }).length <= 1)

  if (save.courierBoard) {
    const board = save.courierBoard
    check(board.day === save.daytime.day && board.offeredQuestIds.filter(id => references.quests.find(quest => quest.id === id)?.deliveryKind === 'courier').length <= 1
      && board.offeredQuestIds.filter(id => references.quests.find(quest => quest.id === id)?.findItem).length <= 1)
    check(new Set(board.offeredQuestIds).size === board.offeredQuestIds.length && new Set(board.acceptedQuestIds).size === board.acceptedQuestIds.length)

    for (const id of board.offeredQuestIds) check(references.quests.some(quest => quest.id === id && quest.repeatable && !quest.offeredBy))

    for (const id of board.acceptedQuestIds) check(board.offeredQuestIds.includes(id) && save.quests.some(quest => quest.questId === id))
  }

  if (save.npcJobs) {
    const board = save.npcJobs
    check(board.day === save.daytime.day)
    check(new Set(board.offeredQuestIds).size === board.offeredQuestIds.length && new Set(board.acceptedQuestIds).size === board.acceptedQuestIds.length)

    /**
     * Perform npc ids.
     * @param {readonly string[]} ids - The ids supplied to this operation.
     * @returns {string[]} The result described by the TypeScript return signature.
     */
    const npcIds = (ids: readonly string[]) => ids.map(id => {
      const quest = references.quests.find(quest => quest.id === id)
      check(quest?.repeatable && quest.offeredBy)

      for (const prerequisite of quest!.prerequisites ?? []) check(isQuestCompleted(prerequisite, save.quests, references.quests))

      return quest!.offeredBy
    })
    check(new Set(npcIds(board.offeredQuestIds)).size === board.offeredQuestIds.length)
    check(new Set(npcIds(board.acceptedQuestIds)).size === board.acceptedQuestIds.length)

    for (const id of board.acceptedQuestIds) check(board.offeredQuestIds.includes(id) && save.quests.some(quest => quest.questId === id))
  }
}
