import type { DialogueChoice } from '../../../domain/dialogue/dialogue.ts'

/** Owns the current NPC conversation path, including returns through shared nodes. */
export class DialogueNavigation {
  private path: string[] = []

  /** Clear navigation when a conversation opens or closes. @returns {void} */
  reset(): void {
    this.path = []
  }

  /**
   * Record a node transition, trimming the path when returning to an earlier menu.
   * @param {string} nodeId - Node now displayed in the conversation.
   * @returns {void} Updates the conversation-local path.
   */
  visit(nodeId: string): void {
    const index = this.path.indexOf(nodeId)
    if (index >= 0) this.path.length = index + 1
    else this.path.push(nodeId)
  }

  /**
   * Supply a return choice where authored dialogue has no existing Back action.
   * @param {readonly DialogueChoice[]} choices - Visible authored choices for this node.
   * @returns {DialogueChoice | undefined} Back to the preceding menu, or no addition.
   */
  getBackChoice(choices: readonly DialogueChoice[]): DialogueChoice | undefined {
    const parent = this.path.at(-2)
    if (!parent || choices.some(choice => choice.id === 'back')) return undefined

    return { id: 'back', text: 'Back.', next: parent }
  }
}
