import type Phaser from 'phaser'
import type { GameServices } from '../../../app/contracts/game'
import { ITEM_BY_ID } from '../../../content/items'
import { buffFearResistance, chargePerkAction } from '../../../domain/character/perks'
import { fearDamage } from '../../../domain/combat/patrolCombat'
import { resolveFearResistance } from '../../../domain/inventory/items'
import { itemBuffMultiplier } from '../../../domain/skills/effects'
import { Hero } from '../../entities/Hero'
import { PatrolManager } from '../../entities/PatrolManager'

/** Explicit combat capabilities; actors are read lazily across construction and phase changes. */
interface CombatAccess {
  scene: Phaser.Scene
  services: Pick<GameServices, 'status' | 'statistics' | 'inventory' | 'character'
    | 'perks' | 'loading' | 'skillEffects' | 'audio'>
  getHero(): Hero
  getPatrols(): PatrolManager
  blocked(): boolean
}

/** Resolves world attacks and damage feedback without owning actor or service state. */
export class LocationCombatController {
  private readonly access: CombatAccess

  /**
   * Bind combat to scene-owned actors and typed service actions.
   * @param {CombatAccess} access - Live actor readers, feedback and damage capabilities.
   */
  constructor(access: CombatAccess) { this.access = access }

  /**
     * Perform damage hero for LocationWorld.
     * @param {number} amount - Amount to apply to the operation.
     * @returns {void} Completes the operation without returning a value.
     */
  damageHero = (amount: number): void => {
    const before = this.access.services.status.getSnapshot().health
    this.access.services.status.takeDamage(amount)
    this.access.services.statistics.record(
      'damageTaken',
      before - this.access.services.status.getSnapshot().health
    )
    if (this.access.services.status.getSnapshot().health <= 0) this.access.getHero().die()
    else this.access.getHero().showDamage()
  }

  /**
     * Perform damage fear for LocationWorld.
     * @param {number} amount - Amount to apply to the operation.
     * @param {boolean} aura - The aura supplied to this operation.
     * @returns {void} Completes the operation without returning a value.
     */
  damageFear = (
    amount: number,
    aura = false
  ): void => {
    const resistance = resolveFearResistance(
      this.access.services.inventory.getBonusItems(),
      ITEM_BY_ID,
      this.access.services.character?.skills ?? {},
      buffFearResistance(
        this.access.services.perks.getSnapshot(),
        this.access.services.perks.buffDefinitions,
        itemBuffMultiplier(this.access.services.character?.skills ?? {})
      )
    )
    const sanityBefore = this.access.services.status.getSnapshot().sanity
    this.access.services.status.drain({ sanity: fearDamage(amount, resistance) })
    if (aura && this.access.services.status.getSnapshot().sanity < sanityBefore
      && this.access.services.status.getSnapshot().health > 0 && !this.access.blocked()
      && this.access.services.loading.getSnapshot().phase === 'idle') {
      this.access.scene.cameras.main.shake(180, 0.002)
    }

    if (this.access.services.status.getSnapshot().health <= 0) this.access.getHero().die()
  }

  /**
     * Perform attack for LocationWorld.
     * @param {"melee" | "shot"} kind - The kind supplied to this operation.
     * @param {number} multiplier - Scaling factor applied to the base value.
     * @param {string | undefined} itemId - Identifier of the item being processed.
     * @param {number} charge - The charge supplied to this operation.
     * @returns {boolean} Whether the requested condition is satisfied.
     */
  attack(
    kind: 'melee' | 'shot',
    multiplier = 1,
    itemId?: string,
    charge = 0.5
  ): boolean {
    if (this.access.blocked() || this.access.services.status.getSnapshot().health <= 0) return false

    const weaponMultiplier = this.access.services.inventory.getWeaponDamageMultiplier(kind, itemId)
    if (kind === 'shot' && !this.access.services.inventory.tryShoot(itemId)) return false

    const damage = this.access.getPatrols().attack(
      this.access.getHero(),
      kind,
      this.access.services.skillEffects,
      multiplier * weaponMultiplier,
      this.access.services.character?.skills,
      charge
    )
    this.access.services.audio.cue(kind === 'shot' ? 'shot' : damage > 0 ? 'meleeHit' : 'meleeMiss')
    this.access.services.statistics.record(kind === 'shot' ? 'shots' : 'meleeAttacks')
    this.access.services.statistics.record('damageDealt', damage)
    const action = chargePerkAction(charge, damage)
    if (action) this.access.services.perks.recordAction(action)

    this.access.getHero().showAttackDamage(damage)

    return true
  }
}
