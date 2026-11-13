export type TimedAttackKind = 'melee' | 'shot'
export interface AttackTimingSettings { halfCycleMs: number; minDamageMultiplier: number; maxDamageMultiplier: number }

/** A full-size ring contracts to the center, expands, and repeats in gameplay time. */
export class AttackTiming {
  private elapsedMs = 0
  private attack?: TimedAttackKind
  private readonly settings: AttackTimingSettings

  private readonly adjustDamage: (charge: number) => number
  constructor(settings: AttackTimingSettings, adjustDamage: (charge: number) => number = () => 0) {
    this.settings = settings
    this.adjustDamage = adjustDamage
  }
  get chargeRatio(): number { return 1 - this.radiusRatio }
  get kind(): TimedAttackKind | undefined { return this.attack }
  get active(): boolean { return this.attack !== undefined }
  get radiusRatio(): number {
    return Math.abs(1 - (this.elapsedMs % (this.settings.halfCycleMs * 2)) / this.settings.halfCycleMs)
  }
  get damageMultiplier(): number {
    return this.settings.minDamageMultiplier + (1 - this.radiusRatio) * (this.settings.maxDamageMultiplier - this.settings.minDamageMultiplier) + this.adjustDamage(this.chargeRatio)
  }
  begin(kind: TimedAttackKind): boolean {
    if (this.active) return false
    this.attack = kind
    this.elapsedMs = 0
    return true
  }
  update(deltaMs: number): void {
    if (this.active && Number.isFinite(deltaMs)) this.elapsedMs = (this.elapsedMs + Math.max(0, deltaMs)) % (this.settings.halfCycleMs * 2)
  }
  release(): { kind: TimedAttackKind; multiplier: number } | undefined {
    if (!this.attack) return undefined
    const result = { kind: this.attack, multiplier: this.damageMultiplier }
    this.cancel()
    return result
  }
  cancel(): void { this.attack = undefined; this.elapsedMs = 0 }
}
