import type { DialogueChoice, DialogueDefinition } from '../../../domain/dialogue/dialogue'
import type { ContentContext } from './context'
import { requireCondition } from './assertions.ts'

/**
 * Check a navigation-only quest topic without allowing entry to commit its decision.
 * @param {DialogueChoice} reply - Parent topic linking to a group of quest actions.
 * @param {DialogueDefinition} definition - Dialogue containing the destination node.
 * @param {ContentContext} context - Quest registry used to resolve the topic's owner.
 * @param {string} path - Authored reply path for validation diagnostics.
 * @returns {void} Throws if the topic lacks alternatives or also executes a quest action.
 */
export function validateQuestTopic(
  reply: DialogueChoice,
  definition: DialogueDefinition,
  context: ContentContext,
  path: string
): void {
  if (!reply.questTopic) return

  const alternatives = definition.nodes[reply.next ?? '']?.choices.filter(choice =>
    choice.questId === reply.questTopic) ?? []
  requireCondition(!reply.questId && !reply.acceptQuestId && !reply.storyDecision
    && context.quests.some(quest => quest.id === reply.questTopic)
    && alternatives.length >= 2, `${path}.questTopic: requires a navigation-only quest decision branch`)
}
