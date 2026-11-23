import type Phaser from 'phaser'
import { HERO_ACTION, HERO_SETTINGS } from '../../../content/hero'
import { AttackTiming } from '../../../domain/combat/attackTiming'
import { AttackTimingOverlay } from '../../combat/AttackTimingOverlay'
import type { InputActions } from '../../input/KeyboardMouseInput'

/** Rendering and action capabilities supplied by the owning hero. */
interface HeroAttackAccess {
  sprite: Phaser.GameObjects.Sprite
  canInteract(): boolean
  idle(): void
  canPrepareShot(): boolean
  requestMelee(multiplier: number, charge: number): boolean
  requestShot(multiplier: number, charge: number): boolean
}

/** Owns charged-attack preparation and feedback, without owning hero movement. */
export class HeroAttackController {
  private readonly access: HeroAttackAccess
  private readonly attackTiming: AttackTiming
  private readonly attackOverlay: AttackTimingOverlay
  private quickAttackHeld = false
  private quickAttackAction?: (multiplier: number, charge: number) => boolean

  /**
   * Prepare timing and overlay resources for one hero.
   * @param {Phaser.Scene} scene - Scene that owns the feedback overlay.
   * @param {HeroAttackAccess} access - Hero rendering and committed attack callbacks.
   * @param {(charge: number) => number} chargeDamage - Perk damage adjustment by charge.
   */
  constructor(scene: Phaser.Scene, access: HeroAttackAccess, chargeDamage: (charge: number) => number) {
    this.access = access
    this.attackTiming = new AttackTiming(HERO_SETTINGS.attackTiming, chargeDamage)
    this.attackOverlay = new AttackTimingOverlay(scene)
  }

  /** @returns {boolean} Whether attack preparation currently blocks hero movement. */
  get active(): boolean { return this.attackTiming.active }

  /**
     * Begin melee preparation only when the hero can interact.
     * @returns {void} Completes the operation without returning a value.
     */
  fight(): void {
    if (!this.access.canInteract() || !this.attackTiming.begin('melee')) return

    this.access.sprite.play(HERO_ACTION.fightPrepare)
    this.attackOverlay.update(this.attackTiming)
  }

  /**
     * Prepare an attack using an explicitly supplied inventory action.
     * @param {"melee" | "shot"} kind - The kind supplied to this operation.
     * @param {(multiplier: number, charge: number) => boolean} perform - The perform supplied to this operation.
     * @returns {void} Completes the operation without returning a value.
     */
  quickAttack(
    kind: 'melee' | 'shot',
    perform: (multiplier: number, charge: number) => boolean
  ): void {
    if (!this.access.canInteract() || !this.attackTiming.begin(kind)) return

    this.quickAttackHeld = true
    this.quickAttackAction = perform
    this.access.sprite.play(kind === 'melee' ? HERO_ACTION.fightPrepare : HERO_ACTION.shootPrepare)
    this.attackOverlay.update(this.attackTiming, 'number key / mouse')
  }

  /**
     * Release the quick-slot input so the next update commits its charged action.
     * @returns {void} Completes the operation without returning a value.
     */
  releaseQuickAttack(): void {
    this.quickAttackHeld = false
  }

  /**
     * Begin ranged preparation after checking both hero and ammunition eligibility.
     * @returns {void} Completes the operation without returning a value.
     */
  shoot(): void {
    if (!this.access.canInteract() || !this.access.canPrepareShot() || !this.attackTiming.begin('shot')) return

    this.access.sprite.play(HERO_ACTION.shootPrepare)
    this.attackOverlay.update(this.attackTiming)
  }

  /**
     * Cancel preparation, clear quick-slot state and return to an eligible idle pose.
     * @returns {void} Completes the operation without returning a value.
     */
  cancelAttackPreparation = (): void => {
    this.quickAttackHeld = false
    this.quickAttackAction = undefined
    if (!this.attackTiming.active) return

    this.attackTiming.cancel()
    this.attackOverlay.hide()
    this.access.idle()
  }

  /**
     * Display committed attack damage through the scene-owned feedback overlay.
     * @param {number} amount - Amount to apply to the operation.
     * @returns {void} Completes the operation without returning a value.
     */
  showAttackDamage(amount: number): void {
    this.attackOverlay.showDamage(amount)
  }

  /**
   * Advance preparation and commit the selected attack only on release.
   * @param {number} delta - Elapsed frame time in milliseconds.
   * @param {InputActions} actions - Held inputs for this frame.
   * @returns {void} Updates feedback or invokes one committed attack callback.
   */
  update(delta: number, actions: InputActions): void {

    this.attackTiming.update(delta)
    const held = this.quickAttackAction ? this.quickAttackHeld : this.attackTiming.kind === 'melee' ? actions.fightHeld : actions.shootHeld
    if (held) this.attackOverlay.update(
      this.attackTiming,
      this.quickAttackAction ? 'number key / mouse' : undefined
    )
    else {
      const charge = this.attackTiming.chargeRatio
      const attack = this.attackTiming.release()!
      this.attackOverlay.hide()
      const perform = this.quickAttackAction
      this.quickAttackAction = undefined
      this.quickAttackHeld = false
      const succeeded = perform ? perform(attack.multiplier, charge) : attack.kind === 'melee' ? this.access.requestMelee(attack.multiplier, charge) : this.access.requestShot(attack.multiplier, charge)
      if (succeeded) this.access.sprite.play(attack.kind === 'melee' ? HERO_ACTION.fight : HERO_ACTION.shoot)
      else this.access.idle()
    }

    return
  }
}
