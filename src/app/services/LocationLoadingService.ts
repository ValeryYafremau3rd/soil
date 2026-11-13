import type { LoadingController, LoadingSnapshot } from '../contracts/loading'
import { ObservableStore } from './ObservableStore.ts'

export class LocationLoadingService extends ObservableStore<LoadingSnapshot> implements LoadingController {
  readonly fadeMs: number
  constructor(fadeMs: number) { super({ phase: 'idle', locationName: '' }); this.fadeMs = fadeMs }
  begin = (locationName: string, fade = true): boolean => {
    if (this.snapshot.phase !== 'idle') return false
    this.publish({ phase: fade ? 'fade-out' : 'loading', locationName })
    return true
  }
  covered = (): void => {
    if (this.snapshot.phase === 'fade-out') this.publish({ ...this.snapshot, phase: 'loading' })
  }
  ready = (): void => {
    if (this.snapshot.phase === 'loading') this.publish({ ...this.snapshot, phase: 'fade-in' })
  }
  finish = (): void => {
    if (this.snapshot.phase === 'fade-in') this.publish({ ...this.snapshot, phase: 'idle' })
  }
}
