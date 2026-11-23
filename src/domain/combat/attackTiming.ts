export type TimedAttackKind = 'melee' | 'shot'
/**
 * Authored timing windows and charge feedback for hero attacks.
 */
export interface AttackTimingSettings {
  halfCycleMs: number
  minDamageMultiplier: number
  maxDamageMultiplier: number
}

/** A full-size ring contracts to the center, expands, and repeats in gameplay time. */
export class AttackTiming {
  private elapsedMs = 0
  private attack?: TimedAttackKind
  private readonly settings: AttackTimingSettings

  private readonly adjustDamage: (charge: number) => number

  /**
   * Initialize the AttackTiming instance and its collaborators.
   * @param {AttackTimingSettings} settings - Configuration values for this instance.
   * @param {(charge: number) => number} adjustDamage - The adjust damage supplied to this operation.
   * @returns {AttackTiming} The initialized instance.
   */
  constructor(
    settings: AttackTimingSettings,
    adjustDamage: (charge: number) => number = () => 0
  ) {
    this.settings = settings
    this.adjustDamage = adjustDamage
  }

  /**
   * Perform charge ratio for AttackTiming.
   * @returns {number} The calculated numeric result.
   */
  get chargeRatio(): number {
    return 1 - this.radiusRatio
  }

  /**
   * Perform kind for AttackTiming.
   * @returns {TimedAttackKind | undefined} The result described by the TypeScript return signature.
   */
  get kind(): TimedAttackKind | undefined {
    return this.attack
  }

  /**
   * Perform active for AttackTiming.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get active(): boolean {
    return this.attack !== undefined
  }

  /**
   * Perform radius ratio for AttackTiming.
   * @returns {number} The calculated numeric result.
   */
  get radiusRatio(): number {
    return Math.abs(1 - (this.elapsedMs % (this.settings.halfCycleMs * 2)) / this.settings.halfCycleMs)
  }

  /**
   * Perform damage multiplier for AttackTiming.
   * @returns {number} The calculated numeric result.
   */
  get damageMultiplier(): number {
    return this.settings.minDamageMultiplier + (1 - this.radiusRatio) * (this.settings.maxDamageMultiplier - this.settings.minDamageMultiplier) + this.adjustDamage(this.chargeRatio)
  }

  /**
   * Perform begin for AttackTiming.
   * @param {TimedAttackKind} kind - The kind supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  begin(kind: TimedAttackKind): boolean {
    if (this.active) return false

    this.attack = kind
    this.elapsedMs = 0

    return true
  }

  /**
   * Perform update for AttackTiming.
   * @param {number} deltaMs - Elapsed gameplay time in milliseconds.
   * @returns {void} Completes the operation without returning a value.
   */
  update(deltaMs: number): void {
    if (this.active && Number.isFinite(deltaMs)) this.elapsedMs = (this.elapsedMs + Math.max(0, deltaMs)) % (this.settings.halfCycleMs * 2)
  }

  /**
   * Perform release for AttackTiming.
   * @returns {{ kind: TimedAttackKind; multiplier: number; } | undefined} The result described by the TypeScript return signature.
   */
  release(): {
    kind: TimedAttackKind
    multiplier: number
  } | undefined {
    if (!this.attack) return undefined

    const result = { kind: this.attack, multiplier: this.damageMultiplier }
    this.cancel()

    return result
  }

  /**
   * Perform cancel for AttackTiming.
   * @returns {void} Completes the operation without returning a value.
   */
  cancel(): void {
    this.attack = undefined
    this.elapsedMs = 0
  }
}
