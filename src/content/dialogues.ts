import type { DialogueDefinition } from '../domain/dialogue/dialogue'
import { CONTENT } from './catalogue'

export const DIALOGUES = CONTENT.data.dialogues as Readonly<Record<string, DialogueDefinition>>
