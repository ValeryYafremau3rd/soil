import type { FearSettings, HeroTarget } from './types'

/** Fear accrues in gameplay time; notice damage fires once on each new detection. */
export class MonsterFear {
  private noticed = false
  private accrued = 0
  private readonly settings: FearSettings

  /**
   * Initialize the MonsterFear instance and its collaborators.
   * @param {FearSettings} settings - Configuration values for this instance.
   * @returns {MonsterFear} The initialized instance.
   */
  constructor(settings: FearSettings) {
    this.settings = settings
  }

  /**
   * Perform affects for MonsterFear.
   * @param {{ x: number; y: number; }} source - Source data or actor used by this operation.
   * @param {HeroTarget} target - Target considered by this operation.
   * @param {boolean} active - The active supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  affects(
    source: {
      x: number
      y: number
    },
    target: HeroTarget,
    active: boolean
  ): boolean {
    return active && target.available && Math.hypot(source.x - target.x, source.y - target.y) <= this.settings.radius
  }

  /**
   * Perform reset for MonsterFear.
   * @returns {void} Completes the operation without returning a value.
   */
  reset(): void {
    this.noticed = false
    this.accrued = 0
  }

  /**
   * Perform update for MonsterFear.
   * @param {number} deltaMs - Elapsed gameplay time in milliseconds.
   * @param {{ x: number; y: number; }} source - Source data or actor used by this operation.
   * @param {HeroTarget} target - Target considered by this operation.
   * @param {boolean} detected - The detected supplied to this operation.
   * @param {boolean} active - The active supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  update(
    deltaMs: number,
    source: {
      x: number
      y: number
    },
    target: HeroTarget,
    detected: boolean,
    active: boolean
  ): number {
    if (!active || !target.available) {
      this.reset()

      return 0
    }

    let damage = detected && !this.noticed ? this.settings.noticeSanityDamage : 0
    this.noticed = detected
    if (this.affects(source, target, active)) {
      this.accrued += this.settings.sanityPerSecond * Math.max(0, deltaMs) / 1000
      const whole = Math.floor(this.accrued + 1e-9)
      damage += whole
      this.accrued -= whole
    } else this.accrued = 0

    return damage
  }
}

/**
 * Perform monster attack sanity damage.
 * @param {number} healthDamage - The health damage supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function monsterAttackSanityDamage(healthDamage: number): number {
  return Number.isFinite(healthDamage) ? Math.max(0, healthDamage) / 2 : 0
}

/**
 * Fear includes aura, notice shocks and the sanity portion of monster attacks.
 * @param {number} amount - Amount to apply to the operation.
 * @param {number} resistancePercent - The resistance percent supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function fearDamage(
  amount: number,
  resistancePercent: number
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0

  const resistance = Number.isFinite(resistancePercent) ? Math.max(0, Math.min(100, resistancePercent)) : 0

  return amount * (1 - resistance / 100)
}
