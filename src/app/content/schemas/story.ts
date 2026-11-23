import { array, boolean, choice, number, object, optional, record, text } from '../schema.ts'
import { endingSlidesSchema } from './endingSlides.ts'

export const storyFactsSchema = record({ kind: 'union', items: [boolean, text] })
export const storyStateSchema = object({
  flags: storyFactsSchema,
  decisions: record(text),
  consequences: array(object({ npcId: text, day: number(1, true) })),
  absentNpcIds: array(text),
})
export const storySchema = object({
  endingSlides: endingSlidesSchema,
  messages: object({
    interact: text,
    unavailable: text, illegalBlocked: text, officialBlocked: text, leave: text,
    complete: text, save: text, load: text, newGame: text,
  }),
  consequenceDelayDays: number(1, true),
  interactionRadius: number(1),
  completedFlags: record(text),
  decisions: array(object({
    id: text, questId: text, choiceId: text, legacyDefault: text,
    options: array(object({
      value: text, npcId: optional(text),
    }), true),
  })),
  interactions: array(object({
    id: text, name: text, locationId: text, x: number(0), text,
    buildingId: optional(text), roomId: optional(text), floor: optional(number(0, true)),
    questId: optional(text), stageId: optional(text),
    route: optional(choice('illegal', 'official')),
    absentNpcId: optional(text), fallbackNpcId: optional(text),
  })),
  ending: object({ illegal: text, official: text }),
})
