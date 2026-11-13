import type { GameMessage, MessageController, MessagePresentation } from '../contracts/messages'
import { ObservableStore } from './ObservableStore.ts'

export class MessageService extends ObservableStore<{ messages: readonly GameMessage[] }> implements MessageController {
  private nextId = 1
  constructor() { super({ messages: [] }) }
  show = (text: string, presentation?: MessagePresentation): void => {
    if (text.trim()) this.publish({ messages: [...this.snapshot.messages, { id: this.nextId++, text, ...(presentation ? { presentation } : {}) }] })
  }
  dismiss = (id: number): void => {
    if (this.snapshot.messages.some(message => message.id === id)) this.publish({ messages: this.snapshot.messages.filter(message => message.id !== id) })
  }
}
