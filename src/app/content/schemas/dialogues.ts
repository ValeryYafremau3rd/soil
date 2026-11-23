import { SKILL_LABELS } from '../../../domain/skills/character.ts'
import { array, boolean, choice, number, object, optional, record, text } from '../schema.ts'
import { integer, barter } from './common.ts'
import { storyFactsSchema } from './story.ts'
export const dialoguesSchema = record(object({
  start: text,
  openingLines: optional(array(text, true)),
  barter: optional(barter),
  barters: optional(array(barter, true)),
  nodes: record(object({
    text,
    choices: array(
      object({
        trustRequirement: optional(number(1, true, 5)),
        skillRequirement: optional(object({
          skill: choice(...Object.keys(SKILL_LABELS)), level: integer,
        })),
        approach: optional(choice('persuasion', 'intimidation')),
        id: text,
        storyConditions: optional(storyFactsSchema),
        storyDecision: optional(object({ id: text, value: text })),
        questChoiceId: optional(text),
        questTopic: optional(text),
        requirementFailureText: optional(text),
        text,
        next: optional(text),
        close: optional(boolean),
        barter: optional(boolean),
        questId: optional(text),
        acceptQuestId: optional(text),
        requiresQuest: optional(text),
        barterId: optional(text)
      }),
      true
    ),
  }))
}))
