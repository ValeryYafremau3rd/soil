import type Phaser from 'phaser'
import type { DayPhase } from '../../app/contracts/daytime'
import { resolvePatrolEncounter, resolveEmptyInteriorSpawns } from '../../app/content/resolvePatrolPopulation'
import { resolveNpcPlacements } from '../../app/content/resolveNpcPlacements'
import { NPCS } from '../../content/npcs'
import { LOCATIONS } from '../../content/locations'
import type { PatrolSpace } from '../../app/content/resolvePatrolPopulation'
import type { PatrolDefinition } from '../../content/types'
import { PATROLS } from '../../content/patrols'
import { HERO_SETTINGS } from '../../content/hero'
import { Npc } from './Npc'
import { Patrol } from './Patrol'
import { closestPatrol, MonsterFear, monsterAttackSanityDamage, PatrolPerkTracker } from '../../domain/combat/patrolCombat'
import type { PerkAction } from '../../domain/character/perks'
import type { HeroTarget } from '../../domain/combat/patrolCombat'
import type { Hero } from './Hero'
import { patrolDifficulty, patrolMovementDifficulty } from '../../domain/character/difficulty'
import type { DifficultyRules } from '../../domain/character/difficulty'
import { legendarySkill, legendaryAttackMultiplier, interruptsAttack } from '../../domain/skills/effects'
import skillConfig from '../../content/skills.json'
import type { Character } from '../../domain/skills/character'
import type { SkillEffects } from '../../domain/skills/effects'
import { GAME_SETTINGS } from '../../content/world'

export class PatrolManager {
  private readonly patrols: readonly Patrol[]
  private readonly damageHero: (amount: number) => void
  private readonly difficulty: DifficultyRules
  private readonly night: boolean
  private readonly damageFear: (amount: number, aura?: boolean) => void
  private readonly contexts = new Map<Patrol, { buildingId?: string; floor?: number; roomId?: string }>()
  private readonly fears = new Map<Patrol, MonsterFear>()
  private context: { buildingId?: string; floor?: number; roomId?: string } = {}
  private combatAlert = false
  private readonly engagedPolice = new Set<Patrol>()
  private readonly perkTracker = new PatrolPerkTracker()
  private readonly onMonsterDefeated: () => void
  private readonly onPoliceAction: (action: PerkAction) => void

  static preload(scene: Phaser.Scene): void {
    for (const definition of Object.values(PATROLS.types)) Npc.preloadAssets(scene, definition)
  }

  constructor(scene: Phaser.Scene, locationId: string, phase: DayPhase, groundY: number, width: number, damageHero: (amount: number) => void,
    difficulty: DifficultyRules, spaces: readonly PatrolSpace[] = [], damageFear: (amount: number, aura?: boolean) => void = () => {}, random: () => number = Math.random,
    onCorpse?: (source: Phaser.GameObjects.Sprite, definition: PatrolDefinition, context: { buildingId?: string; floor?: number }) => void,
    onPoliceAction: (action: PerkAction) => void = () => {},
    heroContext: { buildingId?: string; roomId?: string } = {}, onMonsterDefeated: () => void = () => {}) {
    this.onMonsterDefeated = onMonsterDefeated
    this.onPoliceAction = onPoliceAction
    this.damageHero = damageHero
    this.difficulty = difficulty
    this.night = phase === 'night'
    this.damageFear = damageFear
    const patrols: Patrol[] = []
    const spawn = (id: string, definition: PatrolDefinition, count: number, bounds: { left: number; right: number }, y: number,
      scale: number, context: { buildingId?: string; floor?: number; roomId?: string }, chaseBounds = bounds) => {
      const combat = patrolDifficulty(definition.combat, difficulty, definition.kind)
      const movement = patrolMovementDifficulty(definition.movement, difficulty, definition.kind)
      for (let index = 0; index < count; index++) {
        const patrol = new Patrol(scene, `${id}-${index + 1}`, { ...definition, combat, movement, scale },
          bounds.left + (bounds.right - bounds.left) * (index + 1) / (count + 1), y, bounds,
          definition.kind === 'monster' ? chaseBounds : bounds,
          definition.corpseLoot && onCorpse ? () => onCorpse(patrol.sprite, definition, context) : undefined)
        patrols.push(patrol)
        this.contexts.set(patrol, context)
        if (definition.kind === 'monster' && combat.fear) this.fears.set(patrol, new MonsterFear(combat.fear))
      }
    }
    const population = resolvePatrolEncounter(PATROLS, locationId, phase, random)
    if (population) {
      const { definition, location, count } = population
      const bounds = { left: Math.max(HERO_SETTINGS.edgeMargin, width * location.bounds.left),
        right: Math.min(width - HERO_SETTINGS.edgeMargin, width * location.bounds.right) }
      spawn(`${locationId}-patrol`, definition, count, bounds, groundY, (definition.scale ?? 1) * (location.scale ?? 1), {},
        { left: HERO_SETTINGS.edgeMargin, right: width - HERO_SETTINGS.edgeMargin })
    }
    const occupants = resolveNpcPlacements(NPCS, LOCATIONS, locationId, phase)
    for (const { definition, space } of resolveEmptyInteriorSpawns(PATROLS, locationId, phase, spaces, occupants, random, heroContext)) {
      const roomScale = space.roomId && definition.kind === 'human' ? HERO_SETTINGS.roomScale / HERO_SETTINGS.scale : 1
      const scale = Math.min(0.9 * roomScale,
        (space.clearance - GAME_SETTINGS.interaction.interiorHeadroom) / definition.displayHeight)
      spawn(`${locationId}-${space.buildingId}-${space.roomId ?? space.floor}`, definition, 1, space.bounds, space.groundY, scale,
        { buildingId: space.buildingId, floor: space.floor, roomId: space.roomId }, space.bounds)
    }
    this.patrols = patrols
    this.setContext()
  }

  setContext(buildingId?: string, floor?: number, roomId?: string): void {
    if (buildingId !== this.context.buildingId || floor !== this.context.floor || roomId !== this.context.roomId) {
      this.combatAlert = false
      this.perkTracker.cancelChases()
    }
    this.context = { buildingId, floor, roomId }
    for (const patrol of this.patrols) {
      const context = this.contexts.get(patrol)!
      const visible = context.roomId === roomId && context.buildingId === buildingId && (!buildingId || context.floor === floor)
      patrol.setVisible(visible)
      if (!visible) { patrol.sprite.anims.pause(); this.fears.get(patrol)?.reset() }
    }
  }
  pause(): void { for (const patrol of this.patrols) patrol.sprite.anims.pause() }
  destroy(): void { for (const patrol of this.patrols) patrol.destroy() }
  get heroDetected(): boolean { return this.patrols.some(patrol => patrol.detectsHero) }
  get inCombat(): boolean {
    return this.patrols.some(patrol => patrol.sprite.visible && patrol.sprite.active && patrol.health > 0 && patrol.combat.aggressive)
  }
  underFearAura(target: HeroTarget): boolean {
    return this.patrols.some(patrol => this.fears.get(patrol)?.affects(patrol.sprite, target,
      patrol.sprite.visible && patrol.sprite.active && patrol.health > 0))
  }

  attack(hero: Hero, kind: 'melee' | 'shot', effects?: Pick<SkillEffects, 'meleeDamage' | 'rangedDamage'>, timingMultiplier = 1, skills: Partial<Character['skills']> = {}, charge = 0.5): number {
    const origin = { x: hero.sprite.x, y: hero.sprite.y, bounds: hero.sprite.getBounds() }
    const targets = this.patrols.map(patrol => ({
      patrol, x: patrol.sprite.x, y: patrol.sprite.y, bounds: patrol.sprite.getBounds(),
      health: patrol.health, visible: patrol.sprite.visible && patrol.sprite.active,
    }))
    const heroSettings = this.difficulty.hero
    const target = closestPatrol(origin, targets, kind, heroSettings.meleeRange, heroSettings.combatLevelTolerance)
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
    if (healthBefore > 0 && target.patrol.health === 0 && target.patrol.kind === 'monster') this.onMonsterDefeated()
    return healthBefore - target.patrol.health
  }

  private recordPoliceEngagement(patrol: Patrol): void {
    if (this.engagedPolice.has(patrol)) return
    this.engagedPolice.add(patrol)
    this.onPoliceAction('policeEngaged')
  }

  update(delta: number, target: HeroTarget, detectionMultiplier = 1, trackPerks = true, skills: Partial<Character['skills']> = {}): void {
    // Snapshot before updating any patrol so assistance does not depend on array order.
    const inCombat = this.combatAlert || this.patrols.some(patrol => patrol.sprite.visible && patrol.health > 0 && patrol.combat.aggressive)
    this.combatAlert = false
    for (const patrol of this.patrols) {
      if (!patrol.sprite.visible || !patrol.sprite.active) continue
      patrol.detect(target, this.night, detectionMultiplier, inCombat, legendarySkill(skills, 'persuasion'))
      if (trackPerks && delta > 0) {
        const inRange = Math.hypot(patrol.sprite.x - target.x, patrol.sprite.y - target.y) <= patrol.detectionRadius * detectionMultiplier
        for (const action of this.perkTracker.observe(patrol.id, { alive: patrol.health > 0,
          visible: patrol.sprite.visible && patrol.sprite.active, hidden: target.hidden === true, inRange, detected: patrol.detectsHero })) {
          this.onPoliceAction(patrol.kind === 'human' ? action : action === 'policeEscaped' ? 'monsterEscaped' : 'monsterHidden')
        }
      }
      if (patrol.kind === 'human' && patrol.health > 0 && patrol.combat.aggressive) this.recordPoliceEngagement(patrol)
      const fear = this.fears.get(patrol)?.update(Math.min(Math.max(0, delta), HERO_SETTINGS.maxDeltaMs),
        patrol.sprite, target, patrol.detectsHero, patrol.health > 0) ?? 0
      if (fear > 0) this.damageFear(fear, true)
      patrol.tick(delta, target, damage => {
        if (patrol.kind === 'monster') this.damageFear(monsterAttackSanityDamage(damage))
        this.damageHero(damage)
      }, legendarySkill(skills, 'intimidation') ? skillConfig.legendary.enemyAttackSpeed : 1)
    }
  }
}
