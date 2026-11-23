export type MessagePresentation = 'notification' | 'success'
/**
 * User-facing message payload owned by the message service.
 */
export interface GameMessage {
  readonly id: number
  readonly text: string
  readonly presentation?: MessagePresentation
}
/**
 * Typed message actions and queries exposed across application layers.
 */
export interface MessageController {
  getSnapshot(): {
    readonly messages: readonly GameMessage[]
  }
  subscribe(listener: () => void): () => void
  show(text: string, presentation?: MessagePresentation): void
  dismiss(id: number): void
}
