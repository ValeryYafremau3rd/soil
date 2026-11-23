/**
 * Observable notes state exposed to service subscribers.
 */
export interface NotesSnapshot {
  readonly locations: readonly string[]
  readonly people: readonly string[]
  readonly items: readonly string[]
}
/**
 * Typed notes actions and queries exposed across application layers.
 */
export interface NotesController {
  getSnapshot(): NotesSnapshot
  subscribe(listener: () => void): () => void
  visitLocation(id: string): void
  meetPerson(id: string): void
  discoverItems(ids: readonly string[]): void
}
