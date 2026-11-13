export type LoadingPhase = 'idle' | 'fade-out' | 'loading' | 'fade-in'
export interface LoadingSnapshot { readonly phase: LoadingPhase; readonly locationName: string }
export interface LoadingController {
  readonly fadeMs: number
  getSnapshot(): LoadingSnapshot
  subscribe(listener: () => void): () => void
  begin(locationName: string, fade?: boolean): boolean
  covered(): void
  ready(): void
  finish(): void
}
