import { PatrolDeathController } from './patrol/PatrolDeathController'
import type Phaser from 'phaser'
import { HERO_SETTINGS } from '../../content/hero'
import type { PatrolDefinition } from '../../content/types'
import { GAME_SETTINGS } from '../../content/world'
import type { HeroTarget, PatrolAttack } from '../../domain/combat/patrolCombat'
import { detectsHero, patrolAttackKind, PatrolCombat } from '../../domain/combat/patrolCombat'
import { Wanderer } from '../../domain/npcs/Wanderer'
import { HealthBar } from '../rendering/HealthBar'
import { Npc } from './Npc'

/**
 * Owns patrol state and behavior.
 */
export class Patrol extends Npc {
  readonly id: string
  readonly combat: PatrolCombat
  private readonly wanderer: Wanderer
  private readonly walkAnimation: string
  private readonly runAnimation: string
  private detecting = false
  private provoked = false
  private readonly attackAnimation: string
  private readonly shootAnimation?: string
  private pendingAttack?: PatrolAttack
  private attackComplete = false
  private readonly combatSettings: PatrolDefinition['combat']
  private readonly patrolKind: 'human' | 'monster'
  private readonly chaseBounds: {
    left: number
    right: number
  }
  private readonly death: PatrolDeathController
  private readonly healthBar: HealthBar
  private flashMs = 0

  /**
   * Initialize the Patrol instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {string} id - The id supplied to this operation.
   * @param {PatrolDefinition} definition - The definition supplied to this operation.
   * @param {number} x - Horizontal coordinate.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {{ left: number; right: number; }} bounds - The bounds supplied to this operation.
   * @param {{ left: number; right: number; }} chaseBounds - The chase bounds supplied to this operation.
   * @param {(() => void) | undefined} onCorpse - The on corpse supplied to this operation.
   * @returns {Patrol} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    id: string,
    definition: PatrolDefinition,
    x: number,
    groundY: number,
    bounds: {
      left: number
      right: number
    },
    chaseBounds = bounds,
    onCorpse?: () => void
  ) {
    super(scene, definition, x, groundY)
    this.id = id
    this.patrolKind = definition.kind ?? 'human'
    this.walkAnimation = definition.walk.key
    this.runAnimation = definition.run.key
    this.attackAnimation = definition.attack.key
    this.shootAnimation = definition.shoot?.key
    this.wanderer = new Wanderer(x, bounds, definition.movement)
    this.chaseBounds = chaseBounds
    this.combatSettings = definition.combat
    this.combat = new PatrolCombat(definition.combat)
    this.death = new PatrolDeathController({
      sprite: this.sprite,
      health: () => this.health,
      hide: () => this.setVisible(false),
      onCorpse,
    }, definition.death.key, definition.combat.deathHoldMs)
    this.sprite.on(
      `animationcomplete-${this.attackAnimation}`,
      () => {
        this.attackComplete = true
      }
    )
    if (this.shootAnimation) this.sprite.on(
      `animationcomplete-${this.shootAnimation}`,
      () => {
        this.attackComplete = true
      }
    )

    this.healthBar = new HealthBar(scene)
    this.drawHealth()
  }

  /**
   * Perform melee range for Patrol.
   * @returns {number} The calculated numeric result.
   */
  get meleeRange(): number {
    return this.combatSettings.meleeRange
  }

  /**
   * Perform melee height tolerance for Patrol.
   * @returns {number} The calculated numeric result.
   */
  get meleeHeightTolerance(): number {
    return this.combatSettings.levelTolerance
  }

  /**
   * Perform cancel pending attack for Patrol.
   * @returns {void} Completes the operation without returning a value.
   */
  cancelPendingAttack(): void {
    this.combat.cancelAttack()
    if (this.attackPlaying) this.sprite.anims.stop()

    this.attackComplete = false
    this.pendingAttack = undefined
    this.sprite.anims.timeScale = 1
  }

  /**
   * Perform health for Patrol.
   * @returns {number} The calculated numeric result.
   */
  get health(): number {
    return this.combat.health
  }

  /**
   * Perform detection radius for Patrol.
   * @returns {number} The calculated numeric result.
   */
  get detectionRadius(): number {
    return this.combatSettings.detectionRadius
  }

  /**
   * Perform kind for Patrol.
   * @returns {"human" | "monster"} The result described by the TypeScript return signature.
   */
  get kind(): 'human' | 'monster' {
    return this.patrolKind
  }

  /**
   * Perform detects hero for Patrol.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get detectsHero(): boolean {
    return this.detecting && this.health > 0 && this.sprite.visible
  }

  /**
   * Perform attack playing for Patrol.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private get attackPlaying(): boolean {
    const key = this.sprite.anims.currentAnim?.key

    return this.sprite.anims.isPlaying && (key === this.attackAnimation || Boolean(this.shootAnimation && key === this.shootAnimation))
  }

  /**
   * Perform detect for Patrol.
   * @param {HeroTarget} target - Target considered by this operation.
   * @param {boolean} night - The night supplied to this operation.
   * @param {number} detectionMultiplier - The detection multiplier supplied to this operation.
   * @param {boolean} inCombat - The in combat supplied to this operation.
   * @param {boolean} peaceful - Whether Diplomacy pacifies unprovoked human patrols only.
   * @returns {void} Completes the operation without returning a value.
   */
  detect(
    target: HeroTarget,
    night: boolean,
    detectionMultiplier = 1,
    inCombat = false,
    peaceful = false
  ): void {
    if (peaceful && this.kind === 'human' && !this.provoked) {
      this.detecting = false
      this.combat.disengage()
      this.cancelPendingAttack()

      return
    }

    this.detecting = this.health > 0 && this.sprite.visible && detectsHero(
      this.sprite,
      target,
      this.combatSettings.detectionRadius * detectionMultiplier,
      night,
      inCombat,
      this.kind === 'monster'
    )
    if (this.detecting) this.combat.engage()
    else if (!this.provoked) {
      this.combat.disengage()
      this.attackComplete = false
      this.pendingAttack = undefined
      if (this.attackPlaying) this.sprite.anims.stop()
    }
  }

  /**
   * Perform receive damage for Patrol.
   * @param {number} amount - Amount to apply to the operation.
   * @param {boolean} fromHero - The from hero supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  receiveDamage(amount: number, fromHero = true): void {
    if (!this.combat.receiveDamage(amount)) return

    if (fromHero) this.provoked = true

    if (this.health === 0) {
      this.attackComplete = false
      this.pendingAttack = undefined
      this.death.begin()
    } else {
      this.flashMs = this.combatSettings.hitFlashMs
      this.sprite.setTint(GAME_SETTINGS.combatFeedback.hitTint)
    }

    this.drawHealth()
  }

  /**
   * Perform engage enemy for Patrol.
   * @returns {void} Completes the operation without returning a value.
   */
  engageEnemy(): void {
    this.detecting = false
    this.combat.engage()
  }

  /**
   * Perform tick for Patrol.
   * @param {number} delta - Elapsed time since the previous update.
   * @param {HeroTarget} target - Target considered by this operation.
   * @param {(amount: number) => void} damageHero - The damage hero supplied to this operation.
   * @param {number} attackSpeed - The attack speed supplied to this operation.
   * @param {(event: string) => void} cue - The cue supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  tick(
    delta: number,
    target: HeroTarget,
    damageHero: (amount: number) => void,
    attackSpeed = 1,
    cue: (event: string) => void = () => { }
  ): void {
    const elapsed = Math.min(Math.max(0, delta), HERO_SETTINGS.maxDeltaMs)
    if (this.health <= 0) {
      this.death.update(elapsed)

      return
    }

    this.sprite.anims.timeScale = this.attackPlaying ? attackSpeed : 1
    this.sprite.anims.resume()
    this.flashMs = Math.max(0, this.flashMs - elapsed)
    if (this.flashMs === 0) this.sprite.clearTint()

    if (this.combat.aggressive) {
      const settings = this.combatSettings
      const heightDifference = Math.abs(target.y - this.sprite.y)
      const distance = target.x - this.sprite.x
      const available = target.available && heightDifference <= (settings.ranged?.heightTolerance ?? settings.levelTolerance)
      const attackKind = target.available ? patrolAttackKind(settings, distance, this.provoked, heightDifference) : undefined
      if (this.attackComplete) {
        this.attackComplete = false
        const range = this.pendingAttack === 'shot' ? settings.ranged!.range : settings.meleeRange
        const heightTolerance = this.pendingAttack === 'shot' ? settings.ranged!.heightTolerance : settings.levelTolerance
        const damage = this.combat.finishAttack(
          Math.abs(distance) <= range && heightDifference <= heightTolerance,
          target.available && this.sprite.visible && this.sprite.active
        )
        cue(this.pendingAttack === 'shot' ? 'shot' : damage > 0 ? 'meleeHit' : 'meleeMiss')
        this.pendingAttack = undefined
        if (damage > 0) damageHero(damage)
      }

      if (this.attackPlaying) {
        this.combat.update(elapsed * attackSpeed, false, available)
        this.drawHealth()

        return
      }

      if ((available || target.available && this.kind === 'monster') && !attackKind) {
        const step = Math.min(
          Math.abs(distance) - settings.meleeRange * settings.chaseStopRatio,
          settings.chaseSpeed * elapsed / 1000
        )
        const chaseStep = Math.max(0, step)
        this.sprite.x = Math.max(
          this.chaseBounds.left,
          Math.min(this.chaseBounds.right, this.sprite.x + Math.sign(distance) * chaseStep)
        )
        this.sprite.setFlipX(distance < 0)
        if (chaseStep > 0) this.sprite.play(this.runAnimation, true)
        else this.idle()
      } else {
        this.idle()
        if (available) this.sprite.setFlipX(distance < 0)
      }

      this.wanderer.x = this.sprite.x
      const attack = this.combat.update(elapsed * attackSpeed, attackKind !== undefined, available, attackKind)
      if (attack > 0) {
        this.pendingAttack = attackKind
        this.sprite.play(attackKind === 'shot' ? this.shootAnimation! : this.attackAnimation)
        this.sprite.anims.timeScale = attackSpeed
      }
    } else {
      this.wanderer.update(elapsed)
      this.sprite.setX(this.wanderer.x).setFlipX(this.wanderer.direction < 0)
      if (this.wanderer.walking) this.sprite.play(this.walkAnimation, true)
      else this.idle()
    }

    this.drawHealth()
  }

  /**
   * Perform draw health for Patrol.
   * @returns {void} Completes the operation without returning a value.
   */
  private drawHealth(): void {
    this.healthBar.draw(
      this.sprite.x,
      this.sprite.y - this.definition.displayHeight * (this.definition.scale ?? 1),
      this.health,
      this.combatSettings.health,
      this.sprite.visible && this.health > 0 && this.combat.aggressive
    )
  }

  /**
   * Set visible.
   * @param {boolean} visible - Whether the presentation should be visible.
   * @returns {void} Completes the operation without returning a value.
   */
  override setVisible(visible: boolean): void {
    if (!visible) {
      this.detecting = false
      this.combat.cancelAttack()
      this.attackComplete = false
      this.pendingAttack = undefined
      if (this.attackPlaying) this.sprite.anims.stop()
    }

    const show = visible && (this.health > 0 || this.death.visible)
    super.setVisible(show)
    this.healthBar.setVisible(show && this.health > 0 && this.combat.aggressive)
  }

  /**
   * Perform destroy for Patrol.
   * @returns {void} Completes the operation without returning a value.
   */
  override destroy(): void {
    this.healthBar.destroy()
    super.destroy()
  }

  /**
   * Check whether interact with is allowed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  override canInteractWith(): boolean {
    return false
  }

  /**
   * Perform interact for Patrol.
   * @returns {void} Completes the operation without returning a value.
   */
  protected interact(): void { /* Patrol combat is driven by attacks rather than dialogue. */ }
}
