import type { VerticalState } from './platforms'

/**
 * Safe fall threshold and damage scaling consumed by fall tracking.
 */
export interface FallDamageSettings {
  safeHeight: number
  damagePerPixel: number
}

/**
 * Perform fall damage.
 * @param {number} distance - The distance supplied to this operation.
 * @param {FallDamageSettings} settings - Configuration values for this instance.
 * @returns {number} The calculated numeric result.
 */
export function fallDamage(distance: number, settings: FallDamageSettings): number {
  if (!Number.isFinite(distance) || distance <= settings.safeHeight) return 0

  return Math.ceil((distance - settings.safeHeight) * settings.damagePerPixel)
}

/** Measure each uninterrupted drop from its highest point, resolving it once on landing. */
export class FallTracker {
  private highestY?: number
  private readonly settings: FallDamageSettings

  /**
   * Initialize the FallTracker instance and its collaborators.
   * @param {FallDamageSettings} settings - Configuration values for this instance.
   * @returns {FallTracker} The initialized instance.
   */
  constructor(settings: FallDamageSettings) {
    this.settings = settings
  }

  /**
   * Perform reset for FallTracker.
   * @returns {void} Completes the operation without returning a value.
   */
  reset(): void {
    this.highestY = undefined
  }

  /**
   * Perform update for FallTracker.
   * @param {VerticalState} previous - The previous supplied to this operation.
   * @param {VerticalState} current - The current supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  update(previous: VerticalState, current: VerticalState): number {
    if (previous.grounded && current.grounded) {
      this.reset()

      return 0
    }

    this.highestY = Math.min(this.highestY ?? previous.y, previous.y, current.y)
    if (!current.grounded) return 0

    const damage = fallDamage(current.y - this.highestY, this.settings)
    this.reset()

    return damage
  }
}
