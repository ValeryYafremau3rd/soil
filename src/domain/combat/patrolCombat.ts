import type { PatrolAttack, PatrolCombatSettings } from './patrolCombat/types'

// Keep the established public entry point for game, services and saved-content types.
export type {
  CombatBounds, CombatPosition, PatrolTarget, PatrolCombatSettings,
  FearSettings, HeroTarget, PatrolAttack, CorpseDrop,
} from './patrolCombat/types'
export { PatrolPerkTracker } from './patrolCombat/encounters.ts'
export { MonsterFear, monsterAttackSanityDamage, fearDamage } from './patrolCombat/fear.ts'
export {
  rollCorpseLoot, patrolAttackKind, detectsHero, closestPatrol,
} from './patrolCombat/targeting.ts'

/** Attacks start in gameplay time; damage is resolved only after animation completion. */
export class PatrolCombat {
  health: number
  aggressive = false
  private cooldownMs = 0
  private attackPending?: PatrolAttack
  private readonly settings: PatrolCombatSettings

  /**
   * Initialize the PatrolCombat instance and its collaborators.
   * @param {PatrolCombatSettings} settings - Configuration values for this instance.
   * @returns {PatrolCombat} The initialized instance.
   */
  constructor(settings: PatrolCombatSettings) {
    this.settings = settings
    this.health = settings.health
  }

  /**
   * Perform engage for PatrolCombat.
   * @returns {void} Completes the operation without returning a value.
   */
  engage(): void {
    if (this.health <= 0 || this.aggressive) return

    this.cooldownMs = this.settings.reactionDelayMs
    this.aggressive = true
  }

  /**
   * Perform disengage for PatrolCombat.
   * @returns {void} Completes the operation without returning a value.
   */
  disengage(): void {
    this.aggressive = false
    this.cooldownMs = 0
    this.cancelAttack()
  }

  /**
   * Perform receive damage for PatrolCombat.
   * @param {number} amount - Amount to apply to the operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  receiveDamage(amount: number): boolean {
    if (this.health <= 0 || !Number.isFinite(amount) || amount <= 0) return false

    this.health = Math.max(0, this.health - amount)
    if (this.health === 0) this.cancelAttack()

    this.engage()

    return true
  }

  /**
   * Perform update for PatrolCombat.
   * @param {number} deltaMs - Elapsed gameplay time in milliseconds.
   * @param {boolean} inRange - The in range supplied to this operation.
   * @param {boolean} targetAvailable - The target available supplied to this operation.
   * @param {PatrolAttack} kind - The kind supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  update(
    deltaMs: number,
    inRange: boolean,
    targetAvailable: boolean,
    kind: PatrolAttack = 'melee'
  ): number {
    if (this.health <= 0 || !this.aggressive || !targetAvailable) return 0

    this.cooldownMs = Math.max(0, this.cooldownMs - Math.max(0, deltaMs))
    if (!inRange || this.cooldownMs > 0 || this.attackPending) return 0

    if (kind === 'shot' && !this.settings.ranged) return 0

    this.cooldownMs = this.settings.attackCooldownMs
    this.attackPending = kind

    return kind === 'shot' ? this.settings.ranged!.damage : this.settings.meleeDamage
  }

  /**
   * Perform finish attack for PatrolCombat.
   * @param {boolean} inRange - The in range supplied to this operation.
   * @param {boolean} targetAvailable - The target available supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  finishAttack(inRange: boolean, targetAvailable: boolean): number {
    const pending = this.attackPending
    this.attackPending = undefined

    return pending && this.health > 0 && inRange && targetAvailable
      ? pending === 'shot' ? this.settings.ranged!.damage : this.settings.meleeDamage : 0
  }

  /**
   * Perform cancel attack for PatrolCombat.
   * @returns {void} Completes the operation without returning a value.
   */
  cancelAttack(): void {
    this.attackPending = undefined
  }
}
