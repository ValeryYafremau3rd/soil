export type MessagePresentation = 'notification' | 'success'
export interface GameMessage { readonly id: number; readonly text: string; readonly presentation?: MessagePresentation }
export interface MessageController {
  getSnapshot(): { readonly messages: readonly GameMessage[] }
  subscribe(listener: () => void): () => void
  show(text: string, presentation?: MessagePresentation): void
  dismiss(id: number): void
}
