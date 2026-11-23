import type { DialogueDefinition } from '../../domain/dialogue/dialogue'

/**
 * Current dialogue participants, node and selection context.
 */
export interface Conversation {
  readonly kind?: 'investigation'
  readonly npcName: string
  readonly npcId?: string
  readonly trust?: number
  readonly text: string
  readonly choices: readonly {
    id: string
    text: string
    visited?: boolean
  }[]
}

/**
 * Observable dialogue state exposed to service subscribers.
 */
export interface DialogueSnapshot {
  readonly conversation: Conversation | null
}

/**
 * Typed dialogue actions and queries exposed across application layers.
 */
export interface DialogueController {
  getSnapshot(): DialogueSnapshot
  subscribe(listener: () => void): () => void
  openDialogue(npcName: string, definition: DialogueDefinition, npcId?: string): void
  openInvestigation(
    definition: DialogueDefinition,
    actions?: {
      canChoose(id: string): boolean
      choose(id: string): boolean
    },
    npcId?: string
  ): void
  chooseReply(choiceId: string): void
  closeDialogue(): void
}
