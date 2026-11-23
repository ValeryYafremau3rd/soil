export type LoadingPhase = 'idle' | 'fade-out' | 'loading' | 'fade-in'
/**
 * Observable loading state exposed to service subscribers.
 */
export interface LoadingSnapshot {
  readonly phase: LoadingPhase
  readonly locationName: string
}
/**
 * Typed loading actions and queries exposed across application layers.
 */
export interface LoadingController {
  readonly fadeMs: number
  getSnapshot(): LoadingSnapshot
  subscribe(listener: () => void): () => void
  begin(locationName: string, fade?: boolean): boolean
  covered(): void
  ready(): void
  finish(): void
}
