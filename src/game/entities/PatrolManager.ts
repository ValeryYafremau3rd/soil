import type Phaser from 'phaser'
import type { PatrolSpace } from '../../app/content/resolvePatrolPopulation'
import type { AudioController } from '../../app/contracts/audio'
import type { DayPhase } from '../../app/contracts/daytime'
import { HERO_SETTINGS } from '../../content/hero'
import { PATROLS } from '../../content/patrols'
import skillConfig from '../../content/skills.json'
import type { PatrolDefinition } from '../../content/types'
import type { DifficultyRules } from '../../domain/character/difficulty'
import type { PerkAction } from '../../domain/character/perks'
import type { HeroTarget } from '../../domain/combat/patrolCombat'
import { closestPatrol, monsterAttackSanityDamage, MonsterFear, PatrolPerkTracker } from '../../domain/combat/patrolCombat'
import { nearestPatrolEnemy } from '../../domain/combat/patrolEnemies'
import type { Character } from '../../domain/skills/character'
import type { SkillEffects } from '../../domain/skills/effects'
import { interruptsAttack, legendaryAttackMultiplier, legendarySkill } from '../../domain/skills/effects'
import type { Hero } from './Hero'
import { Npc } from './Npc'
import { Patrol } from './Patrol'
import { spawnPatrolPopulation } from './patrol/spawnPatrolPopulation'

/**
 * Owns patrol manager state and behavior.
 */
export class PatrolManager {
  private readonly patrols: readonly Patrol[]
  private readonly audio?: AudioController
  private readonly types = new Map<Patrol, string>()
  private readonly damageHero: (amount: number) => void
  private readonly difficulty: DifficultyRules
  private readonly night: boolean
  private readonly damageFear: (amount: number, aura?: boolean) => void
  private readonly contexts = new Map<Patrol, {
    buildingId?: string
    floor?: number
    roomId?: string
  }>()
  private readonly fears = new Map<Patrol, MonsterFear>()
  private context: {
    buildingId?: string
    floor?: number
    roomId?: string
  } = {}
  private combatAlert = false
  private readonly engagedPolice = new Set<Patrol>()
  private readonly enemies = new Map<Patrol, Patrol>()
  private readonly perkTracker = new PatrolPerkTracker()
  private readonly onMonsterDefeated: () => void
  private readonly onPoliceAction: (action: PerkAction) => void

  /**
   * Perform preload for PatrolManager.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {void} Completes the operation without returning a value.
   */
  static preload(scene: Phaser.Scene): void {
    for (const definition of Object.values(PATROLS.types)) Npc.preloadAssets(scene, definition)
  }

  /**
   * Initialize the PatrolManager instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {string} locationId - The location id supplied to this operation.
   * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {number} width - The width supplied to this operation.
   * @param {(amount: number) => void} damageHero - The damage hero supplied to this operation.
   * @param {object} difficulty - The difficulty supplied to this operation.
   * @param {readonly PatrolSpace[]} spaces - The spaces supplied to this operation.
   * @param {(amount: number, aura?: boolean | undefined) => void} damageFear - The damage fear supplied to this operation.
   * @param {() => number} random - Random-number source; injectable for deterministic results.
   * @param {Function} onCorpse - The on corpse supplied to this operation.
   * @param {Function} onPoliceAction - The on police action supplied to this operation.
   * @param {{ buildingId?: string | undefined; roomId?: string | undefined; }} heroContext - The hero context supplied to this operation.
   * @param {() => void} onMonsterDefeated - The on monster defeated supplied to this operation.
   * @param {AudioController | undefined} audio - The audio supplied to this operation.
   * @param {number} day - The day supplied to this operation.
   * @returns {PatrolManager} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    locationId: string,
    phase: DayPhase,
    groundY: number,
    width: number,
    damageHero: (amount: number) => void,
    difficulty: DifficultyRules,
    spaces: readonly PatrolSpace[] = [],
    damageFear: (amount: number, aura?: boolean) => void = () => { },
    random: () => number = Math.random,
    onCorpse?: (
      source: Phaser.GameObjects.Sprite,
      definition: PatrolDefinition,
      context: {
        buildingId?: string
        floor?: number
      }
    ) => void,
    onPoliceAction: (action: PerkAction) => void = () => { },
    heroContext: {
      buildingId?: string
      roomId?: string
    } = {},
    onMonsterDefeated: () => void = () => { },
    audio?: AudioController,
    day = 1
  ) {
    this.audio = audio
    this.onMonsterDefeated = onMonsterDefeated
    this.onPoliceAction = onPoliceAction
    this.damageHero = damageHero
    this.difficulty = difficulty
    this.night = phase === 'night'
    this.damageFear = damageFear
    this.patrols = spawnPatrolPopulation({
      scene, locationId, phase, groundY, width, difficulty, spaces,
      random, heroContext, day, onCorpse,
      register: (patrol, definition, context, fear) => {
        this.types.set(patrol,
          Object.entries(PATROLS.types).find(([, entry]) => entry === definition)?.[0] ?? 'monster')
        this.contexts.set(patrol, context)
        if (definition.kind === 'monster' && fear) this.fears.set(patrol, new MonsterFear(fear))
      },
    })
    this.setContext()
  }

  /**
   * Set context.
   * @param {string | undefined} buildingId - The building id supplied to this operation.
   * @param {number | undefined} floor - The floor supplied to this operation.
   * @param {string | undefined} roomId - The room id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  setContext(
    buildingId?: string,
    floor?: number,
    roomId?: string
  ): void {
    if (buildingId !== this.context.buildingId || floor !== this.context.floor || roomId !== this.context.roomId) {
      this.combatAlert = false
      this.perkTracker.cancelChases()
    }

    this.context = { buildingId, floor, roomId }

    for (const patrol of this.patrols) {
      const context = this.contexts.get(patrol)!
      const visible = context.roomId === roomId && context.buildingId === buildingId && (!buildingId || context.floor === floor)
      patrol.setVisible(visible)
      if (!visible) {
        patrol.sprite.anims.pause()
        this.fears.get(patrol)?.reset()
      }
    }
  }

  /**
   * Perform pause for PatrolManager.
   * @returns {void} Completes the operation without returning a value.
   */
  pause(): void {
    for (const patrol of this.patrols) patrol.sprite.anims.pause()
  }

  /**
   * Perform destroy for PatrolManager.
   * @returns {void} Completes the operation without returning a value.
   */
  destroy(): void {
    for (const patrol of this.patrols) patrol.destroy()
  }

  /**
   * Perform pursuit kind for PatrolManager.
   * @returns {"human" | "monster" | null} The result described by the TypeScript return signature.
   */
  get pursuitKind(): 'human' | 'monster' | null {
    const active = this.patrols.filter(patrol => patrol.sprite.visible && patrol.sprite.active && patrol.health > 0 && patrol.combat.aggressive)

    return active.some(patrol => patrol.kind === 'monster') ? 'monster' : active.length ? 'human' : null
  }

  /**
   * Perform hero detected for PatrolManager.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get heroDetected(): boolean {
    return this.patrols.some(patrol => patrol.detectsHero)
  }

  /**
   * Perform in combat for PatrolManager.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get inCombat(): boolean {
    return this.patrols.some(patrol => patrol.sprite.visible && patrol.sprite.active && patrol.health > 0 && patrol.combat.aggressive)
  }

  /**
   * Perform under fear aura for PatrolManager.
   * @param {HeroTarget} target - Target considered by this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  underFearAura(target: HeroTarget): boolean {
    return this.patrols.some(patrol => this.fears.get(patrol)?.affects(patrol.sprite, target,
      patrol.sprite.visible && patrol.sprite.active && patrol.health > 0))
  }

  /**
   * Perform attack for PatrolManager.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {"melee" | "shot"} kind - The kind supplied to this operation.
   * @param {object} effects - The effects supplied to this operation.
   * @param {number} timingMultiplier - The timing multiplier supplied to this operation.
   * @param {Partial<Skills>} skills - The skills supplied to this operation.
   * @param {number} charge - The charge supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  attack(
    hero: Hero,
    kind: 'melee' | 'shot',
    effects?: Pick<SkillEffects, 'meleeDamage' | 'rangedDamage'>,
    timingMultiplier = 1,
    skills: Partial<Character['skills']> = {},
    charge = 0.5
  ): number {
    const origin = { x: hero.sprite.x, y: hero.sprite.y, bounds: hero.sprite.getBounds() }
    const targets = this.patrols.map(patrol => ({
      patrol, x: patrol.sprite.x, y: patrol.sprite.y, bounds: patrol.sprite.getBounds(),
      health: patrol.health, visible: patrol.sprite.visible && patrol.sprite.active,
    }))
    const heroSettings = this.difficulty.hero
    const target = closestPatrol(
      origin,
      targets,
      kind,
      heroSettings.meleeRange,
      heroSettings.combatLevelTolerance
    )
    if (!target) return 0
    // Even a lethal opening hit can alert other patrols that see the hero.
    this.combatAlert = true
    hero.sprite.setFlipX(target.x < origin.x)
    const damage = kind === 'melee' ? heroSettings.meleeDamage * (effects?.meleeDamage ?? 1)
      : heroSettings.shotDamage * (effects?.rangedDamage ?? 1)
    const healthBefore = target.patrol.health
    const startedFight = !this.inCombat
    const threatened = targets.some(other => other.visible && other.health > 0 && Math.abs(other.x - origin.x) <= other.patrol.meleeRange && Math.abs(other.y - origin.y) <= other.patrol.meleeHeightTolerance)
    const legendary = legendaryAttackMultiplier(skills, kind, threatened, target.patrol.combat.aggressive)
    target.patrol.receiveDamage(Math.round(damage * timingMultiplier * legendary))
    if (kind === 'melee' && target.patrol.health > 0 && target.patrol.health < healthBefore && interruptsAttack(skills, charge)) target.patrol.cancelPendingAttack()

    if (startedFight && target.patrol.health < healthBefore) {
      this.onPoliceAction(target.patrol.kind === 'human' ? 'policeFightStarted' : 'monsterFightStarted')
    }

    if (target.patrol.kind === 'human' && target.patrol.health < healthBefore) {
      this.recordPoliceEngagement(target.patrol)
      this.onPoliceAction('policeHit')
      if (target.patrol.health === 0) this.onPoliceAction('policeKilled')
    }

    if (healthBefore > 0 && target.patrol.health === 0) {
      this.onPoliceAction(kind === 'melee' ? 'meleeDefeat' : 'gunDefeat')
    }

    if (healthBefore > 0 && target.patrol.health === 0 && target.patrol.kind === 'monster') this.onMonsterDefeated()

    return healthBefore - target.patrol.health
  }

  /**
   * Perform record police engagement for PatrolManager.
   * @param {Patrol} patrol - The patrol supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private recordPoliceEngagement(patrol: Patrol): void {
    if (this.engagedPolice.has(patrol)) return

    this.engagedPolice.add(patrol)
    this.onPoliceAction('policeEngaged')
  }

  /**
   * Perform update for PatrolManager.
   * @param {number} delta - Elapsed time since the previous update.
   * @param {HeroTarget} target - Target considered by this operation.
   * @param {number} detectionMultiplier - The detection multiplier supplied to this operation.
   * @param {boolean} trackPerks - The track perks supplied to this operation.
   * @param {Partial<Skills>} skills - The skills supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  update(
    delta: number,
    target: HeroTarget,
    detectionMultiplier = 1,
    trackPerks = true,
    skills: Partial<Character['skills']> = {}
  ): void {
    // Snapshot before updating any patrol so assistance does not depend on array order.
    const inCombat = this.combatAlert || this.patrols.some(patrol => patrol.detectsHero)
    this.combatAlert = false

    for (const patrol of this.patrols) {
      if (!patrol.sprite.visible || !patrol.sprite.active) continue

      const previous = this.enemies.get(patrol)
      const enemy = nearestPatrolEnemy(patrol, this.patrols)
      if (previous !== enemy) {
        patrol.cancelPendingAttack()
        this.enemies.delete(patrol)
      }

      if (enemy) {
        this.enemies.set(patrol, enemy)
        patrol.engageEnemy()
        const fear = this.fears.get(patrol)?.update(delta, patrol.sprite, target, false, patrol.health > 0) ?? 0
        if (fear > 0) this.damageFear(fear, true)

        patrol.tick(
          delta,
          { x: enemy.sprite.x, y: enemy.sprite.y, available: enemy.health > 0 },
          damage => enemy.receiveDamage(damage, false),
          1,
          event => this.audio?.cue(event)
        )
        continue
      }

      const detected = patrol.detectsHero
      patrol.detect(
        target,
        this.night,
        detectionMultiplier,
        inCombat,
        patrol.kind === 'human' && legendarySkill(skills, 'persuasion')
      )
      if (!detected && patrol.detectsHero && patrol.kind === 'monster') this.audio?.spotted(this.types.get(patrol) ?? 'monster')

      if (trackPerks && delta > 0) {
        const inRange = Math.hypot(patrol.sprite.x - target.x, patrol.sprite.y - target.y) <= patrol.detectionRadius * detectionMultiplier

        for (const action of this.perkTracker.observe(
          patrol.id,
          {
            alive: patrol.health > 0,
            visible: patrol.sprite.visible && patrol.sprite.active,
            hidden: target.hidden === true,
            inRange,
            detected: patrol.detectsHero
          }
        )) {
          this.onPoliceAction(action === 'chaseHidden' || patrol.kind === 'human'
            ? action : action === 'policeEscaped' ? 'monsterEscaped' : 'monsterHidden')
        }
      }

      if (patrol.kind === 'human' && patrol.health > 0 && patrol.combat.aggressive) this.recordPoliceEngagement(patrol)

      const fear = this.fears.get(patrol)?.update(Math.min(Math.max(0, delta), HERO_SETTINGS.maxDeltaMs),
        patrol.sprite, target, patrol.detectsHero, patrol.health > 0) ?? 0
      if (fear > 0) this.damageFear(fear, true)

      patrol.tick(
        delta,
        target,
        damage => {
          if (patrol.kind === 'monster') this.damageFear(monsterAttackSanityDamage(damage))

          this.damageHero(damage)
        },
        legendarySkill(skills, 'intimidation') ? skillConfig.legendary.enemyAttackSpeed : 1,
        event => this.audio?.cue(event)
      )
    }
  }
}
