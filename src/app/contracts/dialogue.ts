import type { DialogueDefinition } from '../../domain/dialogue/dialogue'

export interface Conversation {
  readonly kind?: 'investigation'
  readonly npcName: string
  readonly trust?: number
  readonly text: string
  readonly choices: readonly { id: string; text: string }[]
}

export interface DialogueSnapshot {
  readonly conversation: Conversation | null
}

export interface DialogueController {
  getSnapshot(): DialogueSnapshot
  subscribe(listener: () => void): () => void
  openDialogue(npcName: string, definition: DialogueDefinition, npcId?: string): void
  openInvestigation(definition: DialogueDefinition): void
  chooseReply(choiceId: string): void
  closeDialogue(): void
}
