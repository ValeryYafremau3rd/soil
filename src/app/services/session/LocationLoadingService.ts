import type { LoadingController, LoadingSnapshot } from '../../contracts/loading'
import { ObservableStore } from '../core/ObservableStore.ts'

/**
 * Owns location loading service state and behavior.
 */
export class LocationLoadingService extends ObservableStore<LoadingSnapshot> implements LoadingController {
  readonly fadeMs: number

  /**
   * Initialize the LocationLoadingService instance and its collaborators.
   * @param {number} fadeMs - The fade ms supplied to this operation.
   * @returns {LocationLoadingService} The initialized instance.
   */
  constructor(fadeMs: number) {
    super({ phase: 'idle', locationName: '' })
    this.fadeMs = fadeMs
  }

  /**
   * Perform begin for LocationLoadingService.
   * @param {string} locationName - The location name supplied to this operation.
   * @param {boolean} fade - The fade supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  begin = (locationName: string, fade = true): boolean => {
    if (this.snapshot.phase !== 'idle') return false

    this.publish({ phase: fade ? 'fade-out' : 'loading', locationName })

    return true
  }

  /**
   * Perform covered for LocationLoadingService.
   * @returns {void} Completes the operation without returning a value.
   */
  covered = (): void => {
    if (this.snapshot.phase === 'fade-out') this.publish({ ...this.snapshot, phase: 'loading' })
  }

  /**
   * Perform ready for LocationLoadingService.
   * @returns {void} Completes the operation without returning a value.
   */
  ready = (): void => {
    if (this.snapshot.phase === 'loading') this.publish({ ...this.snapshot, phase: 'fade-in' })
  }

  /**
   * Perform finish for LocationLoadingService.
   * @returns {void} Completes the operation without returning a value.
   */
  finish = (): void => {
    if (this.snapshot.phase === 'fade-in') this.publish({ ...this.snapshot, phase: 'idle' })
  }
}
