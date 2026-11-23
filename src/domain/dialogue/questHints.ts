import type { DialogueChoice, DialogueDefinition } from './dialogue'
import type { QuestDefinition } from '../quests/quests'

/** Quest queries used to find an NPC's currently actionable authored dialogue. */
export interface QuestHintQueries {
  readonly definitions: readonly QuestDefinition[]
  /**
   * Read the resident's available new-quest invitation.
   * @param {string} npcId - Resident identifier.
   * @returns {string | null} Authored invitation when a new offer is available.
   */
  getOffer(npcId: string): string | null
  /**
   * Check whether a dialogue action can advance a current quest stage.
   * @param {string} questId - Quest identifier.
   * @param {string} npcId - Resident identifier.
   * @param {string} choiceId - Original authored stage trigger.
   * @returns {boolean} Whether items, time and progress permit the action.
   */
  canAdvanceDialogue(questId: string, npcId: string, choiceId: string): boolean
  /**
   * Check a prerequisite's completion status.
   * @param {string} questId - Required quest identifier.
   * @returns {boolean} Whether the quest has finished.
   */
  isCompleted(questId: string): boolean
}

/**
 * Show new offers or a ready active objective using the same gates as NPC dialogue.
 * @param {string} npcId - Stable identity of the speaking resident.
 * @param {DialogueDefinition | undefined} dialogue - Resident's authored dialogue graph.
 * @param {QuestHintQueries | undefined} quests - Current offers and stage eligibility queries.
 * @param {((choice: DialogueChoice) => boolean) | undefined} canChooseStory - Narrative reply gate.
 * @returns {string | null} Authored offer text or active quest title, otherwise no overhead hint.
 */
export function getNpcQuestHint(
  npcId: string,
  dialogue: DialogueDefinition | undefined,
  quests?: QuestHintQueries,
  canChooseStory?: (choice: DialogueChoice) => boolean,
): string | null {
  if (!quests) return null
  const offer = quests.getOffer(npcId)
  if (offer) return offer

  for (const node of Object.values(dialogue?.nodes ?? {})) {
    for (const reply of node.choices) {
      if (!reply.questId || reply.requiresQuest && !quests.isCompleted(reply.requiresQuest)
        || canChooseStory && !canChooseStory(reply)) continue
      if (quests.canAdvanceDialogue(reply.questId, npcId, reply.questChoiceId ?? reply.id)) {
        return quests.definitions.find(quest => quest.id === reply.questId)?.name ?? null
      }
    }
  }
  return null
}
