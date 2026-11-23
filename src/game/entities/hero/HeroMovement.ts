import Phaser from 'phaser'
import { HERO_ACTION, HERO_SETTINGS } from '../../../content/hero'
import type { FallDamageSettings } from '../../../domain/movement/fallDamage'
import { FallTracker } from '../../../domain/movement/fallDamage'
import type { Platform, VerticalState } from '../../../domain/movement/platforms'
import {
  beginJump, blockedHorizontal, jumpGravity, restingAt, stepVertical,
} from '../../../domain/movement/platforms'
import type { InputActions } from '../../input/KeyboardMouseInput'
import type { MovementBounds } from '../Hero'

/** Rendering, action locks and committed movement costs supplied by the hero. */
interface MovementAccess {
  sprite: Phaser.GameObjects.Sprite
  actionLocked(): boolean
  canClimb(): boolean
  idle(): void
  movementMultiplier(): number
  spendMovementEnergy(distance: number, jumped: boolean): void
  onDistanceMoved(distance: number): void
  takeFallDamage(amount: number): void
}

/** Owns vertical integration and fall tracking for one hero, independently of attacks. */
export class HeroMovement {
  private readonly access: MovementAccess
  private groundY: number
  private vertical: VerticalState
  private gravity = jumpGravity(HERO_SETTINGS.jumpHeight, HERO_SETTINGS.jumpDurationMs)
  private readonly fallTracker: FallTracker

  /**
   * Initialize movement at the authored world ground position.
   * @param {MovementAccess} access - Sprite, movement locks, costs and damage callbacks.
   * @param {number} y - Initial ground coordinate in world pixels.
   * @param {FallDamageSettings} fallDamage - Difficulty-resolved fall damage settings.
   */
  constructor(access: MovementAccess, y: number, fallDamage: FallDamageSettings) {
    this.access = access
    this.groundY = y
    this.vertical = restingAt(y)
    this.fallTracker = new FallTracker(fallDamage)
  }

  /** @returns {boolean} Whether the current vertical state rests on a support surface. */
  get grounded(): boolean { return this.vertical.grounded }

  /**
     * Place the hero on a new ground plane and reset accumulated fall tracking.
     * @param {number} x - Horizontal coordinate.
     * @param {number} y - Vertical coordinate.
     * @returns {void} Completes the operation without returning a value.
     */
  standAt(x: number, y: number): void {
    this.fallTracker.reset()
    this.groundY = y
    this.vertical = restingAt(y)
    this.access.sprite.setPosition(x, y)
    this.access.idle()
  }

  /**
     * Move along stairs and charge distance costs without changing vertical support state.
     * @param {number} x - Horizontal coordinate.
     * @param {number} y - Vertical coordinate.
     * @returns {void} Completes the operation without returning a value.
     */
  climbTo(x: number, y: number): void {
    if (!this.access.canClimb()) return

    this.fallTracker.reset()
    this.access.sprite.setFlipX(x < this.access.sprite.x)
    const distance = Math.hypot(x - this.access.sprite.x, y - this.access.sprite.y)
    this.access.onDistanceMoved(distance)
    this.access.spendMovementEnergy(distance, false)
    this.access.sprite.setPosition(x, y).play(HERO_ACTION.run, true)
  }

  /**
     * Restore world coordinates while retaining the current ground plane.
     * @param {number} x - Horizontal coordinate.
     * @param {number} y - Vertical coordinate.
     * @returns {void} Completes the operation without returning a value.
     */
  restoreAt(x: number, y: number): void {
    this.fallTracker.reset()
    this.vertical = restingAt(y)
    this.access.sprite.setPosition(x, y)
    this.access.idle()
  }

  /**
     * Apply horizontal movement, collision bounds and distance-based energy costs.
     * @param {number} direction - The direction supplied to this operation.
     * @param {number} elapsed - The elapsed supplied to this operation.
     * @param {MovementBounds} bounds - The bounds supplied to this operation.
     * @param {readonly Platform[]} platforms - The platforms supplied to this operation.
     * @returns {void} Completes the operation without returning a value.
     */
  run(
    direction: number,
    elapsed: number,
    bounds: MovementBounds,
    platforms: readonly Platform[] = []
  ): void {
    if (this.access.actionLocked() || direction === 0) return

    this.access.sprite.setFlipX(direction < 0)
    const previousX = this.access.sprite.x
    const desiredX = Phaser.Math.Clamp(
      this.access.sprite.x + direction * HERO_SETTINGS.speed * this.access.movementMultiplier() * elapsed / 1000,
      bounds.left,
      bounds.right,
    )
    this.access.sprite.x = blockedHorizontal(previousX, desiredX, this.vertical.y, HERO_SETTINGS.footWidth / 2,
      this.access.sprite.displayHeight, platforms)
    this.access.spendMovementEnergy(Math.abs(this.access.sprite.x - previousX), false)
    if (this.vertical.grounded) this.access.sprite.play(HERO_ACTION.run, true)
  }

  /**
     * Begin a grounded jump constrained by the current ceiling and movement modifier.
     * @param {number} ceiling - The ceiling supplied to this operation.
     * @returns {void} Completes the operation without returning a value.
     */
  jump(ceiling = 0): void {
    if (this.access.actionLocked() || !this.vertical.grounded) return

    const desiredHeight = HERO_SETTINGS.jumpHeight * this.access.movementMultiplier()
    this.gravity = jumpGravity(desiredHeight, HERO_SETTINGS.jumpDurationMs)
    const height = Math.min(desiredHeight,
      Math.max(0, this.access.sprite.y - ceiling - this.access.sprite.displayHeight))
    if (height === 0) return

    this.access.spendMovementEnergy(0, true)
    this.vertical = beginJump(this.vertical, height, this.gravity)
    this.access.sprite.play(HERO_ACTION.jump)
  }

  /**
   * Integrate movement, report actual distance and resolve landing damage in frame order.
   * @param {number} delta - Elapsed frame time in milliseconds.
   * @param {MovementBounds} bounds - Current world horizontal and ceiling limits.
   * @param {InputActions} actions - Jump and direction inputs for the frame.
   * @param {readonly Platform[]} platforms - Eligible support and collision surfaces.
   * @returns {void} Updates the owned movement state and the hero sprite.
   */
  update(delta: number, bounds: MovementBounds, actions: InputActions,
    platforms: readonly Platform[]): void {
    const movementStart = { x: this.access.sprite.x, y: this.access.sprite.y }
    const elapsed = Math.min(delta, HERO_SETTINGS.maxDeltaMs)
    if (actions.jumpPressed) this.jump(bounds.ceiling)

    this.run(actions.direction, elapsed, bounds, platforms)
    const wasGrounded = this.vertical.grounded
    const previous = this.vertical
    this.vertical = stepVertical(
      this.vertical,
      this.access.sprite.x,
      HERO_SETTINGS.footWidth / 2,
      elapsed / 1000,
      this.gravity,
      this.groundY,
      bounds.ceiling + this.access.sprite.displayHeight,
      platforms,
      this.access.sprite.displayHeight
    )
    this.access.sprite.y = this.vertical.y
    // Measure the actual path without charging extra Energy for vertical movement.
    this.access.onDistanceMoved(Math.hypot(this.access.sprite.x - movementStart.x, this.access.sprite.y - movementStart.y))
    const damage = this.fallTracker.update(previous, this.vertical)
    if (damage > 0) this.access.takeFallDamage(damage)

    if (!this.access.canClimb()) return

    if (wasGrounded && !this.vertical.grounded) this.access.sprite.play(HERO_ACTION.jump)

    if (this.vertical.grounded) {
      if (actions.direction === 0) this.access.idle()
      else this.access.sprite.play(HERO_ACTION.run, true)
    }
  }
}
