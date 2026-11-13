import Phaser from 'phaser'
import {
HERO_ACTION,
HERO_ASSET,HERO_SETTINGS,
heroFrameKey
} from '../../content/hero'
import { GAME_SETTINGS } from '../../content/world'
import { AttackTiming } from '../../domain/combat/attackTiming'
import type { FallDamageSettings } from '../../domain/movement/fallDamage'
import { FallTracker } from '../../domain/movement/fallDamage'
import type { Platform,VerticalState } from '../../domain/movement/platforms'
import { beginJump,blockedHorizontal,jumpGravity,restingAt,stepVertical } from '../../domain/movement/platforms'
import { AttackTimingOverlay } from '../combat/AttackTimingOverlay'
import type { InputActions } from '../input/KeyboardMouseInput'
import { prepareHeroAnimations } from '../rendering/prepareHeroAnimations'

export interface MovementBounds {
  left: number
  right: number
  ceiling: number
}

export class Hero {
  readonly sprite: Phaser.GameObjects.Sprite
  private groundY: number
  private hidden?: { id: string; depth: number }
  private vertical: VerticalState
  private gravity = jumpGravity(HERO_SETTINGS.jumpHeight, HERO_SETTINGS.jumpDurationMs)
  private readonly movementMultiplier: () => number
  private readonly requestShot: (multiplier: number, charge: number) => boolean
  private readonly requestMelee: (multiplier: number, charge: number) => boolean
  private readonly canPrepareShot: () => boolean
  private readonly attackTiming: AttackTiming
  private readonly attackOverlay: AttackTimingOverlay
  private hitFlashMs = 0
  private dead = false
  private deathComplete = false
  get deathAnimationComplete(): boolean { return this.deathComplete }
  private readonly fallTracker: FallTracker
  private readonly takeFallDamage: (amount: number) => void
  private readonly onDistanceMoved: (distance: number) => void
  private readonly spendMovementEnergy: (distance: number, jumped: boolean) => void

  static preload(scene: Phaser.Scene): void {
    scene.load.image(HERO_ASSET.key, `${import.meta.env.BASE_URL}${HERO_ASSET.path}`)
  }

  constructor(scene: Phaser.Scene, x: number, y: number, requestShot: (multiplier: number, charge: number) => boolean, requestMelee: (multiplier: number, charge: number) => boolean,
    takeFallDamage: (amount: number) => void, fallDamage: FallDamageSettings, movementMultiplier: () => number = () => 1,
    canPrepareShot: () => boolean = () => true, spendMovementEnergy: (distance: number, jumped: boolean) => void = () => {},
    chargeDamage: (charge: number) => number = () => 0, onDistanceMoved: (distance: number) => void = () => {}) {
    this.onDistanceMoved = onDistanceMoved
    this.attackTiming = new AttackTiming(HERO_SETTINGS.attackTiming, chargeDamage)
    this.spendMovementEnergy = spendMovementEnergy
    this.movementMultiplier = movementMultiplier
    this.fallTracker = new FallTracker(fallDamage)
    this.takeFallDamage = takeFallDamage
    this.requestShot = requestShot
    this.requestMelee = requestMelee
    this.canPrepareShot = canPrepareShot
    this.groundY = y
    this.vertical = restingAt(y)
    prepareHeroAnimations(scene)
    this.sprite = scene.add.sprite(x, y, heroFrameKey(HERO_ACTION.idle, 0))
      .setOrigin(0.5, 1).setScale(HERO_SETTINGS.scale)
    this.attackOverlay = new AttackTimingOverlay(scene)
    scene.game.events.on(Phaser.Core.Events.BLUR, this.cancelAttackPreparation)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cancelAttackPreparation()
      scene.game.events.off(Phaser.Core.Events.BLUR, this.cancelAttackPreparation)
    })
    this.idle()
  }

  private get isAttacking(): boolean {
    const action = this.sprite.anims.currentAnim?.key
    return this.sprite.anims.isPlaying && (action === HERO_ACTION.fight || action === HERO_ACTION.shoot)
  }

  private get isHurt(): boolean {
    return this.sprite.anims.isPlaying && this.sprite.anims.currentAnim?.key === HERO_ACTION.hurt
  }

  private get actionLocked(): boolean { return this.dead || this.isHurt || this.isAttacking || this.attackTiming.active }

  get canInteract(): boolean {
    return !this.hidden && this.vertical.grounded && !this.actionLocked
  }

  get hiddenObjectId(): string | undefined { return this.hidden?.id }

  hideBehind(id: string, x: number, y: number, depth: number): void {
    if (!this.canInteract) return
    this.standAt(x, y)
    this.hidden = { id, depth: this.sprite.depth }
    this.sprite.anims.stop()
    this.sprite.setTexture(heroFrameKey(HERO_ACTION.jump, 0)).setDepth(depth - 0.01)
  }

  reveal(): void {
    if (!this.hidden) return
    this.sprite.setDepth(this.hidden.depth)
    this.hidden = undefined
    this.idle()
  }

  standAt(x: number, y: number): void {
    this.fallTracker.reset()
    this.groundY = y
    this.vertical = restingAt(y)
    this.sprite.setPosition(x, y)
    this.idle()
  }

  climbTo(x: number, y: number): void {
    if (this.dead || this.isHurt) return
    this.fallTracker.reset()
    this.sprite.setFlipX(x < this.sprite.x)
    const distance = Math.hypot(x - this.sprite.x, y - this.sprite.y)
    this.onDistanceMoved(distance)
    this.spendMovementEnergy(distance, false)
    this.sprite.setPosition(x, y).play(HERO_ACTION.run, true)
  }

  restoreAt(x: number, y: number): void {
    this.fallTracker.reset()
    this.vertical = restingAt(y)
    this.sprite.setPosition(x, y)
    this.idle()
  }

  idle(): void {
    if (this.hidden) return
    if (this.actionLocked || !this.vertical.grounded) return
    this.sprite.play(HERO_ACTION.idle, true)
  }

  run(direction: number, elapsed: number, bounds: MovementBounds, platforms: readonly Platform[] = []): void {
    if (this.actionLocked || direction === 0) return
    this.sprite.setFlipX(direction < 0)
    const previousX = this.sprite.x
    const desiredX = Phaser.Math.Clamp(
      this.sprite.x + direction * HERO_SETTINGS.speed * this.movementMultiplier() * elapsed / 1000,
      bounds.left, bounds.right,
    )
    this.sprite.x = blockedHorizontal(previousX, desiredX, this.vertical.y, HERO_SETTINGS.footWidth / 2,
      this.sprite.displayHeight, platforms)
    this.spendMovementEnergy(Math.abs(this.sprite.x - previousX), false)
    if (this.vertical.grounded) this.sprite.play(HERO_ACTION.run, true)
  }

  jump(ceiling = 0): void {
    if (this.actionLocked || !this.vertical.grounded) return
    const desiredHeight = HERO_SETTINGS.jumpHeight * this.movementMultiplier()
    this.gravity = jumpGravity(desiredHeight, HERO_SETTINGS.jumpDurationMs)
    const height = Math.min(desiredHeight,
      Math.max(0, this.sprite.y - ceiling - this.sprite.displayHeight))
    if (height === 0) return
    this.spendMovementEnergy(0, true)
    this.vertical = beginJump(this.vertical, height, this.gravity)
    this.sprite.play(HERO_ACTION.jump)
  }

  fight(): void {
    if (!this.canInteract || !this.attackTiming.begin('melee')) return
    this.sprite.play(HERO_ACTION.fightPrepare)
    this.attackOverlay.update(this.attackTiming)
  }

  private quickAttackHeld = false
  private quickAttackAction?: (multiplier: number, charge: number) => boolean

  quickAttack(kind: 'melee' | 'shot', perform: (multiplier: number, charge: number) => boolean): void {
    if (!this.canInteract || !this.attackTiming.begin(kind)) return
    this.quickAttackHeld = true
    this.quickAttackAction = perform
    this.sprite.play(kind === 'melee' ? HERO_ACTION.fightPrepare : HERO_ACTION.shootPrepare)
    this.attackOverlay.update(this.attackTiming, 'number key / mouse')
  }

  releaseQuickAttack(): void { this.quickAttackHeld = false }

  shoot(): void {
    if (!this.canInteract || !this.canPrepareShot() || !this.attackTiming.begin('shot')) return
    this.sprite.play(HERO_ACTION.shootPrepare)
    this.attackOverlay.update(this.attackTiming)
  }

  cancelAttackPreparation = (): void => {
    this.quickAttackHeld = false
    this.quickAttackAction = undefined
    if (!this.attackTiming.active) return
    this.attackTiming.cancel()
    this.attackOverlay.hide()
    this.idle()
  }

  showAttackDamage(amount: number): void { this.attackOverlay.showDamage(amount) }

  showDamage(): void {
    if (this.dead) return
    this.cancelAttackPreparation()
    this.hitFlashMs = HERO_SETTINGS.hitFlashMs
    this.sprite.setTint(GAME_SETTINGS.combatFeedback.hitTint)
    if (!this.isHurt) this.sprite.play(HERO_ACTION.hurt)
  }

  die(): void {
    if (this.dead) return
    this.cancelAttackPreparation()
    this.reveal()
    this.dead = true
    this.hitFlashMs = 0
    this.sprite.once(`animationcomplete-${HERO_ACTION.death}`, () => { this.deathComplete = true })
    this.sprite.clearTint().play(HERO_ACTION.death)
  }

  update(delta: number, bounds: MovementBounds, actions: InputActions, platforms: readonly Platform[] = []): void {
    if (this.dead) return
    this.hitFlashMs = Math.max(0, this.hitFlashMs - Math.min(delta, HERO_SETTINGS.maxDeltaMs))
    if (this.hitFlashMs === 0) this.sprite.clearTint()
    if (this.hidden) return
    if (actions.fightPressed) this.fight()
    if (actions.shootPressed) this.shoot()
    if (this.attackTiming.active) {
      this.attackTiming.update(delta)
      const held = this.quickAttackAction ? this.quickAttackHeld : this.attackTiming.kind === 'melee' ? actions.fightHeld : actions.shootHeld
      if (held) this.attackOverlay.update(this.attackTiming, this.quickAttackAction ? 'number key / mouse' : undefined)
      else {
        const charge = this.attackTiming.chargeRatio
        const attack = this.attackTiming.release()!
        this.attackOverlay.hide()
        const perform = this.quickAttackAction
        this.quickAttackAction = undefined
        this.quickAttackHeld = false
        const succeeded = perform ? perform(attack.multiplier, charge) : attack.kind === 'melee' ? this.requestMelee(attack.multiplier, charge) : this.requestShot(attack.multiplier, charge)
        if (succeeded) this.sprite.play(attack.kind === 'melee' ? HERO_ACTION.fight : HERO_ACTION.shoot)
        else this.idle()
      }
      return
    }
    if (this.isAttacking) return
    const movementStart = { x: this.sprite.x, y: this.sprite.y }
    const elapsed = Math.min(delta, HERO_SETTINGS.maxDeltaMs)
    if (actions.jumpPressed) this.jump(bounds.ceiling)
    this.run(actions.direction, elapsed, bounds, platforms)
    const wasGrounded = this.vertical.grounded
    const previous = this.vertical
    this.vertical = stepVertical(this.vertical, this.sprite.x, HERO_SETTINGS.footWidth / 2,
      elapsed / 1000, this.gravity, this.groundY, bounds.ceiling + this.sprite.displayHeight, platforms, this.sprite.displayHeight)
    this.sprite.y = this.vertical.y
    // Measure the actual path without charging extra Energy for vertical movement.
    this.onDistanceMoved(Math.hypot(this.sprite.x - movementStart.x, this.sprite.y - movementStart.y))
    const damage = this.fallTracker.update(previous, this.vertical)
    if (damage > 0) this.takeFallDamage(damage)
    if (this.dead || this.isHurt) return
    if (wasGrounded && !this.vertical.grounded) this.sprite.play(HERO_ACTION.jump)
    if (this.vertical.grounded) {
      if (actions.direction === 0) this.idle()
      else this.sprite.play(HERO_ACTION.run, true)
    }
  }

  
}




