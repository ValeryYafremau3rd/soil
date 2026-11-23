import type { GameMessage, MessageController, MessagePresentation } from '../../contracts/messages'
import { ObservableStore } from '../core/ObservableStore.ts'

/**
 * Owns message service state and behavior.
 */
export class MessageService extends ObservableStore<{
  messages: readonly GameMessage[]
}> implements MessageController {
  private nextId = 1

  /**
   * Initialize the MessageService instance and its collaborators.
   * @returns {MessageService} The initialized instance.
   */
  constructor() {
    super({ messages: [] })
  }

  /**
   * Perform show for MessageService.
   * @param {string} text - The text supplied to this operation.
   * @param {MessagePresentation | undefined} presentation - The presentation supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  show = (
    text: string,
    presentation?: MessagePresentation
  ): void => {
    if (text.trim()) this.publish({
      messages: [
        ...this.snapshot.messages,
        { id: this.nextId++, text, ...(presentation ? { presentation } : {}) }
      ]
    })
  }

  /**
   * Perform dismiss for MessageService.
   * @param {number} id - The id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  dismiss = (id: number): void => {
    if (this.snapshot.messages.some(message => message.id === id)) this.publish({ messages: this.snapshot.messages.filter(message => message.id !== id) })
  }
}
