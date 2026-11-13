import { array,boolean,choice,object,optional,record,text } from '../schema.ts'
import { barter } from './common.ts'
export const dialoguesSchema = record(object({ start: text,
    barter: optional(barter), barters: optional(array(barter, true)),
    nodes: record(object({ text,
    choices: array(object({ approach: optional(choice('persuasion', 'intimidation')), id: text, text, next: optional(text), close: optional(boolean), barter: optional(boolean), questId: optional(text), acceptQuestId: optional(text), requiresQuest: optional(text), barterId: optional(text) }), true),
  })) }))
