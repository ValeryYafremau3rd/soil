import { CONTENT } from './catalogue'
import { DIALOGUES } from './dialogues'
import type { NpcDefinition } from './types'
export type { NpcDefinition } from './types'
const sources = CONTENT.data.npcs as Readonly<Record<string, NpcDefinition>>
export const NPCS: Readonly<Record<string, NpcDefinition>> = Object.fromEntries(
  Object.entries(sources).map(([id, definition]) => [
    id,
    {
      ...definition,
      dialogue: definition.dialogueId ? DIALOGUES[definition.dialogueId] : undefined,
    }
  ]),
)
