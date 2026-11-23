import Phaser from 'phaser'
import {
  HERO_ACTION,
  HERO_ASSET,
  HERO_OUTFITS,
  HERO_SETTINGS,
  heroFrameKey
} from '../../content/hero'
import { GAME_SETTINGS } from '../../content/world'
import type { FallDamageSettings } from '../../domain/movement/fallDamage'
import type { Platform } from '../../domain/movement/platforms'
import type { InputActions } from '../input/KeyboardMouseInput'
import { HeroAppearance } from '../rendering/HeroAppearance'
import { prepareHeroAnimations } from '../rendering/prepareHeroAnimations'
import { HeroAttackController } from './hero/HeroAttackController'
import { HeroMovement } from './hero/HeroMovement'

/**
 * Horizontal and ceiling limits applied to hero movement.
 */
export interface MovementBounds {
  left: number
  right: number
  ceiling: number
}

/**
 * Owns hero state and behavior.
 */
export class Hero {
  readonly sprite: Phaser.GameObjects.Sprite
  private readonly movement: HeroMovement
  private readonly attacks: HeroAttackController
  private readonly appearance: HeroAppearance

  /**
   * Set clothing.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @returns {void} Completes the operation without returning a value.
   */
  setClothing(itemId?: string): void {
    this.appearance.setClothing(itemId)
  }
  private hidden?: {
    id: string
    depth: number
  }
  private hitFlashMs = 0
  private dead = false
  private deathComplete = false

  /**
   * Perform death animation complete for Hero.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get deathAnimationComplete(): boolean {
    return this.deathComplete
  }

  /**
   * Perform preload for Hero.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {void} Completes the operation without returning a value.
   */
  static preload(scene: Phaser.Scene): void {
    for (const asset of [HERO_ASSET, ...Object.values(HERO_OUTFITS).map(outfit => outfit.asset)]) {
      if (!scene.textures.exists(asset.key)) scene.load.image(asset.key, `${import.meta.env.BASE_URL}${asset.path}`)
    }
  }

  /**
   * Initialize the Hero instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {number} x - Horizontal coordinate.
   * @param {number} y - Vertical coordinate.
   * @param {(multiplier: number, charge: number) => boolean} requestShot - The request shot supplied to this operation.
   * @param {(multiplier: number, charge: number) => boolean} requestMelee - The request melee supplied to this operation.
   * @param {(amount: number) => void} takeFallDamage - The take fall damage supplied to this operation.
   * @param {FallDamageSettings} fallDamage - The fall damage supplied to this operation.
   * @param {() => number} movementMultiplier - The movement multiplier supplied to this operation.
   * @param {() => boolean} canPrepareShot - The can prepare shot supplied to this operation.
   * @param {(distance: number, jumped: boolean) => void} spendMovementEnergy - The spend movement energy supplied to this operation.
   * @param {(charge: number) => number} chargeDamage - The charge damage supplied to this operation.
   * @param {(distance: number) => void} onDistanceMoved - The on distance moved supplied to this operation.
   * @returns {Hero} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    requestShot: (multiplier: number, charge: number) => boolean,
    requestMelee: (multiplier: number, charge: number) => boolean,
    takeFallDamage: (amount: number) => void,
    fallDamage: FallDamageSettings,
    movementMultiplier: () => number = () => 1,
    canPrepareShot: () => boolean = () => true,
    spendMovementEnergy: (distance: number, jumped: boolean) => void = () => { },
    chargeDamage: (charge: number) => number = () => 0,
    onDistanceMoved: (distance: number) => void = () => { }
  ) {
    prepareHeroAnimations(scene)
    this.sprite = scene.add.sprite(x, y, heroFrameKey(HERO_ACTION.idle, 0))
      .setOrigin(0.5, 1).setScale(HERO_SETTINGS.scale)
    this.appearance = new HeroAppearance(scene, this.sprite)
    this.movement = new HeroMovement({
      sprite: this.sprite,
      actionLocked: () => this.actionLocked,
      canClimb: () => !this.dead && !this.isHurt,
      idle: () => this.idle(),
      movementMultiplier, spendMovementEnergy, onDistanceMoved, takeFallDamage,
    }, y, fallDamage)
    this.attacks = new HeroAttackController(scene, {
      sprite: this.sprite,
      canInteract: () => this.canInteract,
      idle: () => this.idle(),
      canPrepareShot, requestMelee, requestShot,
    }, chargeDamage)
    scene.game.events.on(Phaser.Core.Events.BLUR, this.cancelAttackPreparation)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cancelAttackPreparation()
      scene.game.events.off(Phaser.Core.Events.BLUR, this.cancelAttackPreparation)
    })
    this.idle()
  }

  /**
   * Check whether attacking is true.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private get isAttacking(): boolean {
    const action = this.sprite.anims.currentAnim?.key

    return this.sprite.anims.isPlaying && (action === HERO_ACTION.fight || action === HERO_ACTION.shoot)
  }

  /**
   * Check whether hurt is true.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private get isHurt(): boolean {
    return this.sprite.anims.isPlaying && this.sprite.anims.currentAnim?.key === HERO_ACTION.hurt
  }

  /**
   * Perform action locked for Hero.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private get actionLocked(): boolean {
    return this.dead || this.isHurt || this.isAttacking || this.attacks.active
  }

  /**
   * Check whether running is true.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get isRunning(): boolean {
    return this.canInteract && this.sprite.anims.currentAnim?.key === HERO_ACTION.run
  }

  /**
   * Check whether interact is allowed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get canInteract(): boolean {
    return !this.hidden && this.movement.grounded && !this.actionLocked
  }

  /**
   * Perform hidden object id for Hero.
   * @returns {string | undefined} The result described by the TypeScript return signature.
   */
  get hiddenObjectId(): string | undefined {
    return this.hidden?.id
  }

  /**
   * Perform hide behind for Hero.
   * @param {string} id - The id supplied to this operation.
   * @param {number} x - Horizontal coordinate.
   * @param {number} y - Vertical coordinate.
   * @param {number} depth - The depth supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  hideBehind(
    id: string,
    x: number,
    y: number,
    depth: number
  ): void {
    if (!this.canInteract) return

    this.standAt(x, y)
    this.hidden = { id, depth: this.sprite.depth }
    this.sprite.anims.stop()
    this.sprite.setTexture(this.appearance.frameKey(HERO_ACTION.jump, 0)).setDepth(depth - 0.01)
  }

  /**
   * Perform reveal for Hero.
   * @returns {void} Completes the operation without returning a value.
   */
  reveal(): void {
    if (!this.hidden) return

    this.sprite.setDepth(this.hidden.depth)
    this.hidden = undefined
    this.idle()
  }

  /**
   * Perform stand at for Hero.
   * @param {number} x - Horizontal coordinate.
   * @param {number} y - Vertical coordinate.
   * @returns {void} Completes the operation without returning a value.
   */
  standAt(x: number, y: number): void {
    this.movement.standAt(x, y)
  }

  /**
   * Perform climb to for Hero.
   * @param {number} x - Horizontal coordinate.
   * @param {number} y - Vertical coordinate.
   * @returns {void} Completes the operation without returning a value.
   */
  climbTo(x: number, y: number): void {
    this.movement.climbTo(x, y)
  }

  /**
   * Restore at.
   * @param {number} x - Horizontal coordinate.
   * @param {number} y - Vertical coordinate.
   * @returns {void} Completes the operation without returning a value.
   */
  restoreAt(x: number, y: number): void {
    this.movement.restoreAt(x, y)
  }

  /**
   * Perform idle for Hero.
   * @returns {void} Completes the operation without returning a value.
   */
  idle(): void {
    if (this.hidden) return

    if (this.actionLocked || !this.movement.grounded) return

    this.sprite.play(HERO_ACTION.idle, true)
  }

  /**
   * Perform run for Hero.
   * @param {number} direction - The direction supplied to this operation.
   * @param {number} elapsed - The elapsed supplied to this operation.
   * @param {MovementBounds} bounds - The bounds supplied to this operation.
   * @param {readonly Platform[]} platforms - The platforms supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  run(direction: number, elapsed: number, bounds: MovementBounds,
    platforms: readonly Platform[] = []): void {
    this.movement.run(direction, elapsed, bounds, platforms)
  }

  /**
   * Perform jump for Hero.
   * @param {number} ceiling - The ceiling supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  jump(ceiling = 0): void {
    this.movement.jump(ceiling)
  }

  /**
   * Perform fight for Hero.
   * @returns {void} Completes the operation without returning a value.
   */
  fight(): void {
    this.attacks.fight()
  }


  /**
   * Perform quick attack for Hero.
   * @param {"melee" | "shot"} kind - The kind supplied to this operation.
   * @param {(multiplier: number, charge: number) => boolean} perform - The perform supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  quickAttack(kind: 'melee' | 'shot', perform: (multiplier: number, charge: number) => boolean): void {
    this.attacks.quickAttack(kind, perform)
  }

  /**
   * Perform release quick attack for Hero.
   * @returns {void} Completes the operation without returning a value.
   */
  releaseQuickAttack(): void {
    this.attacks.releaseQuickAttack()
  }

  /**
   * Perform shoot for Hero.
   * @returns {void} Completes the operation without returning a value.
   */
  shoot(): void {
    this.attacks.shoot()
  }

  /**
   * Perform cancel attack preparation for Hero.
   * @returns {void} Completes the operation without returning a value.
   */
  cancelAttackPreparation = (): void => {
    this.attacks.cancelAttackPreparation()
  }

  /**
   * Perform show attack damage for Hero.
   * @param {number} amount - Amount to apply to the operation.
   * @returns {void} Completes the operation without returning a value.
   */
  showAttackDamage(amount: number): void {
    this.attacks.showAttackDamage(amount)
  }

  /**
   * Perform show damage for Hero.
   * @returns {void} Completes the operation without returning a value.
   */
  showDamage(): void {
    if (this.dead) return

    this.cancelAttackPreparation()
    this.hitFlashMs = HERO_SETTINGS.hitFlashMs
    this.sprite.setTint(GAME_SETTINGS.combatFeedback.hitTint)
    if (!this.isHurt) this.sprite.play(HERO_ACTION.hurt)
  }

  /**
   * Perform die for Hero.
   * @returns {void} Completes the operation without returning a value.
   */
  die(): void {
    if (this.dead) return

    this.cancelAttackPreparation()
    this.reveal()
    this.dead = true
    this.hitFlashMs = 0
    this.sprite.once(
      `animationcomplete-${HERO_ACTION.death}`,
      () => {
        this.deathComplete = true
      }
    )
    this.sprite.clearTint().play(HERO_ACTION.death)
  }

  /**
   * Perform update for Hero.
   * @param {number} delta - Elapsed time since the previous update.
   * @param {MovementBounds} bounds - The bounds supplied to this operation.
   * @param {InputActions} actions - The actions supplied to this operation.
   * @param {readonly Platform[]} platforms - The platforms supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  update(
    delta: number,
    bounds: MovementBounds,
    actions: InputActions,
    platforms: readonly Platform[] = []
  ): void {
    if (this.dead) return

    this.hitFlashMs = Math.max(0, this.hitFlashMs - Math.min(delta, HERO_SETTINGS.maxDeltaMs))
    if (this.hitFlashMs === 0) this.sprite.clearTint()

    if (this.hidden) return

    if (actions.fightPressed) this.fight()

    if (actions.shootPressed) this.shoot()

    if (this.attacks.active) {
      this.attacks.update(delta, actions)
      return
    }

    if (this.isAttacking) return

    this.movement.update(delta, bounds, actions, platforms)
  }
}

