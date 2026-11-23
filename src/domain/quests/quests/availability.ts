import skillConfig from '../../../content/skills.json' with { type: 'json' }
import type { QuestDefinition, QuestProgress, CourierBoard } from './types'

/**
 * Check whether quest completed is true.
 * @param {string} id - The id supplied to this operation.
 * @param {readonly QuestProgress[]} progress - The progress supplied to this operation.
 * @param {readonly QuestDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function isQuestCompleted(
  id: string,
  progress: readonly QuestProgress[],
  definitions: readonly QuestDefinition[]
): boolean {
  const definition = definitions.find(quest => quest.id === id)

  return !!definition && progress.some(entry => entry.questId === id && entry.stageIndex >= definition.stages.length)
}

/**
 * Derive trust from current persuasion and finished story quests, including older saves.
 * @param {string} npcId - The npc id supplied to this operation.
 * @param {readonly QuestProgress[]} progress - The progress supplied to this operation.
 * @param {readonly QuestDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {number} persuasion - The persuasion supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function npcTrust(
  npcId: string,
  progress: readonly QuestProgress[],
  definitions: readonly QuestDefinition[],
  persuasion = 0
): number {
  if (!npcId) return 0

  const bonus = Math.floor(Math.max(0, persuasion) / skillConfig.persuasionTrustPoints)

  return Math.min(
    5,
    1 + bonus + new Set(definitions.filter(quest => {
      if (quest.repeatable || !isQuestCompleted(quest.id, progress, definitions)) return false

      const recipient = quest.stages.findLast(stage => stage.trigger.kind === 'dialogue')?.trigger

      return (quest.offeredBy ?? (recipient?.kind === 'dialogue' ? recipient.npcId : undefined)) === npcId
    }).map(quest => quest.id)).size
  )
}

/**
 * Check whether quest available is true.
 * @param {QuestDefinition} quest - The quest supplied to this operation.
 * @param {readonly QuestProgress[]} progress - The progress supplied to this operation.
 * @param {CourierBoard} board - The board supplied to this operation.
 * @param {readonly QuestDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function isQuestAvailable(
  quest: QuestDefinition,
  progress: readonly QuestProgress[],
  board: CourierBoard,
  definitions: readonly QuestDefinition[] = []
): boolean {
  if (quest.deliveryKind && definitions.some(other => other.id !== quest.id && other.deliveryKind === quest.deliveryKind
    && progress.some(entry => entry.questId === other.id && !entry.failed && entry.stageIndex < other.stages.length))) return false

  if (quest.prerequisites?.some(id => !isQuestCompleted(id, progress, definitions))) return false

  const current = progress.find(entry => entry.questId === quest.id)
  if (!quest.repeatable) return !current

  return board.offeredQuestIds.includes(quest.id) && !board.acceptedQuestIds.includes(quest.id)
    && (!current || current.failed || current.stageIndex >= quest.stages.length)
}

/**
 * Share the board offer limit between presentation and acceptance.
 * @param {readonly QuestDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {readonly QuestProgress[]} progress - The progress supplied to this operation.
 * @param {CourierBoard} board - The board supplied to this operation.
 * @param {number} findItemMaxPrice - The find item max price supplied to this operation.
 * @returns {QuestDefinition[]} The result described by the TypeScript return signature.
 */
export function availableBoardQuests(
  definitions: readonly QuestDefinition[],
  progress: readonly QuestProgress[],
  board: CourierBoard,
  findItemMaxPrice: number
): QuestDefinition[] {
  const activeRequest = definitions.some(quest => quest.findItem && progress.some(entry => entry.questId === quest.id
    && entry.stageIndex < quest.stages.length))
  let courierOffered = definitions.some(quest => quest.deliveryKind === 'courier' && progress.some(entry => entry.questId === quest.id && !entry.failed && entry.stageIndex < quest.stages.length))
  let requestOffered = activeRequest

  return definitions.filter(quest => {
    if (quest.autoStart || quest.morningStart || quest.offeredBy || !isQuestAvailable(quest, progress, board, definitions)) return false

    if (quest.deliveryKind === 'courier') {
      if (courierOffered) return false

      courierOffered = true
    }

    if (!quest.findItem) return true

    if (requestOffered || !quest.reward?.money || quest.reward.money > findItemMaxPrice * 2) return false

    requestOffered = true

    return true
  })
}
