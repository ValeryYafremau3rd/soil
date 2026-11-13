import type Phaser from 'phaser'
import { HERO_SETTINGS } from '../../content/hero'
import type { PatrolDefinition } from '../../content/types'
import { GAME_SETTINGS } from '../../content/world'
import type { HeroTarget,PatrolAttack } from '../../domain/combat/patrolCombat'
import { detectsHero,patrolAttackKind,PatrolCombat } from '../../domain/combat/patrolCombat'
import { Wanderer } from '../../domain/npcs/Wanderer'
import { HealthBar } from '../rendering/HealthBar'
import { Npc } from './Npc'

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
  private readonly deathAnimation: string
  private dying = false
  private deathComplete = false
  private deathHoldMs = 0
  private attackComplete = false
  private readonly combatSettings: PatrolDefinition['combat']
  private readonly patrolKind: 'human' | 'monster'
  private readonly chaseBounds: { left: number; right: number }
  private readonly healthBar: HealthBar
  private flashMs = 0
  private readonly onCorpse?: () => void
  private corpseCreated = false

  constructor(scene: Phaser.Scene, id: string, definition: PatrolDefinition, x: number, groundY: number,
    bounds: { left: number; right: number }, chaseBounds = bounds, onCorpse?: () => void) {
    super(scene, definition, x, groundY)
    this.id = id
    this.onCorpse = onCorpse
    this.patrolKind = definition.kind ?? 'human'
    this.walkAnimation = definition.walk.key
    this.runAnimation = definition.run.key
    this.attackAnimation = definition.attack.key
    this.shootAnimation = definition.shoot?.key
    this.deathAnimation = definition.death.key
    this.wanderer = new Wanderer(x, bounds, definition.movement)
    this.chaseBounds = chaseBounds
    this.combatSettings = definition.combat
    this.combat = new PatrolCombat(definition.combat)
    this.sprite.on(`animationcomplete-${this.attackAnimation}`, () => { this.attackComplete = true })
    if (this.shootAnimation) this.sprite.on(`animationcomplete-${this.shootAnimation}`, () => { this.attackComplete = true })
    this.healthBar = new HealthBar(scene)
    this.drawHealth()
  }

  get meleeRange(): number { return this.combatSettings.meleeRange }
  get meleeHeightTolerance(): number { return this.combatSettings.levelTolerance }
  cancelPendingAttack(): void {
    this.combat.cancelAttack()
    if (this.attackPlaying) this.sprite.anims.stop()
    this.attackComplete = false
    this.pendingAttack = undefined
    this.sprite.anims.timeScale = 1
  }
  get health(): number { return this.combat.health }
  get detectionRadius(): number { return this.combatSettings.detectionRadius }
  get kind(): 'human' | 'monster' { return this.patrolKind }
  get detectsHero(): boolean { return this.detecting && this.health > 0 && this.sprite.visible }
  private get attackPlaying(): boolean {
    const key = this.sprite.anims.currentAnim?.key
    return this.sprite.anims.isPlaying && (key === this.attackAnimation || Boolean(this.shootAnimation && key === this.shootAnimation))
  }

  detect(target: HeroTarget, night: boolean, detectionMultiplier = 1, inCombat = false, peaceful = false): void {
    if (peaceful && !this.provoked) { this.detecting = false; this.combat.disengage(); this.cancelPendingAttack(); return }
    this.detecting = this.health > 0 && this.sprite.visible && detectsHero(this.sprite, target, this.combatSettings.detectionRadius * detectionMultiplier, night, inCombat, this.kind === 'monster')
    if (this.detecting) this.combat.engage()
    else if (!this.provoked) {
      this.combat.disengage()
      this.attackComplete = false
      this.pendingAttack = undefined
      if (this.attackPlaying) this.sprite.anims.stop()
    }
  }

  receiveDamage(amount: number): void {
    if (!this.combat.receiveDamage(amount)) return
    this.provoked = true
    if (this.health === 0) {
      this.attackComplete = false
      this.pendingAttack = undefined
      this.dying = true
      this.sprite.clearTint().play(this.deathAnimation)
      this.sprite.once(`animationcomplete-${this.deathAnimation}`, () => {
        this.deathComplete = true
        this.deathHoldMs = this.combatSettings.deathHoldMs
        this.leaveCorpse()
      })
    } else {
      this.flashMs = this.combatSettings.hitFlashMs
      this.sprite.setTint(GAME_SETTINGS.combatFeedback.hitTint)
    }
    this.drawHealth()
  }

  tick(delta: number, target: HeroTarget, damageHero: (amount: number) => void, attackSpeed = 1): void {
    const elapsed = Math.min(Math.max(0, delta), HERO_SETTINGS.maxDeltaMs)
    if (this.health <= 0) {
      this.sprite.anims.timeScale = 1
      if (this.dying) {
        this.sprite.anims.resume()
        if (this.deathComplete) {
          this.deathHoldMs = Math.max(0, this.deathHoldMs - elapsed)
          if (this.deathHoldMs === 0) {
            this.dying = false
            this.sprite.setActive(false)
            this.setVisible(false)
          }
        }
      }
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
        const damage = this.combat.finishAttack(Math.abs(distance) <= range && heightDifference <= heightTolerance,
          target.available && this.sprite.visible && this.sprite.active)
        this.pendingAttack = undefined
        if (damage > 0) damageHero(damage)
      }
      if (this.attackPlaying) {
        this.combat.update(elapsed * attackSpeed, false, available)
        this.drawHealth()
        return
      }
      if ((available || target.available && this.kind === 'monster') && !attackKind) {
        const step = Math.min(Math.abs(distance) - settings.meleeRange * settings.chaseStopRatio, settings.chaseSpeed * elapsed / 1000)
        const chaseStep = Math.max(0, step)
        this.sprite.x = Math.max(this.chaseBounds.left, Math.min(this.chaseBounds.right, this.sprite.x + Math.sign(distance) * chaseStep))
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

  private drawHealth(): void {
 this.healthBar.draw(this.sprite.x, this.sprite.y - this.definition.displayHeight * (this.definition.scale ?? 1),
   this.health, this.combatSettings.health, this.sprite.visible && this.health > 0 && this.combat.aggressive)
}


  override setVisible(visible: boolean): void {
    if (!visible) {
      this.detecting = false
      this.combat.cancelAttack()
      this.attackComplete = false
      this.pendingAttack = undefined
      if (this.attackPlaying) this.sprite.anims.stop()
    }
    const show = visible && (this.health > 0 || this.dying)
    super.setVisible(show)
    this.healthBar.setVisible(show && this.health > 0 && this.combat.aggressive)
  }

  private leaveCorpse(): void {
    if (this.health > 0 || !this.onCorpse || this.corpseCreated) return
    this.corpseCreated = true
    this.onCorpse()
    this.dying = false
    this.sprite.setActive(false)
    this.setVisible(false)
  }

  override destroy(): void { this.healthBar.destroy(); super.destroy() }
  override canInteractWith(): boolean { return false }
  protected interact(): void { /* Patrol combat is driven by attacks rather than dialogue. */ }
}
