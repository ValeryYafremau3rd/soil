export interface CombatBounds { left: number; right: number; top: number; bottom: number }
export interface CombatPosition { x: number; y: number; bounds: CombatBounds }
export interface PatrolTarget extends CombatPosition { health: number; visible: boolean }
export interface PatrolCombatSettings {
  fear?: FearSettings
  detectionRadius: number
  hitFlashMs: number
  chaseStopRatio: number
  health: number
  meleeDamage: number
  meleeRange: number
  ranged?: { damage: number; range: number; heightTolerance: number }
  attackCooldownMs: number
  reactionDelayMs: number
  deathHoldMs: number
  chaseSpeed: number
  levelTolerance: number
}
export interface FearSettings { radius: number; sanityPerSecond: number; noticeSanityDamage: number }
export interface HeroTarget { x: number; y: number; available: boolean; patrolPass?: boolean; hidden?: boolean }

/** Rewards transitions, never individual frames. Context changes cancel pursuit credit. */
export class PatrolPerkTracker {
  private readonly chasing = new Set<string>()
  private readonly concealed = new Set<string>()

  cancelChases(): void { this.chasing.clear() }

  observe(id: string, state: { alive: boolean; visible: boolean; hidden: boolean; inRange: boolean; detected: boolean }): ('policeEscaped' | 'policeHidden')[] {
    const events: ('policeEscaped' | 'policeHidden')[] = []
    if (!state.alive || !state.visible) { this.chasing.delete(id); return events }
    if (state.hidden && state.inRange && !this.concealed.has(id)) {
      this.concealed.add(id)
      events.push('policeHidden')
    }
    if (this.chasing.has(id) && !state.detected && !state.inRange && !state.hidden) events.push('policeEscaped')
    if (state.detected) this.chasing.add(id)
    else this.chasing.delete(id)
    return events
  }
}
export type PatrolAttack = 'melee' | 'shot'
export interface CorpseDrop { itemId: string; min: number; max: number }

export function rollCorpseLoot(drops: readonly CorpseDrop[], random: () => number = Math.random): { itemId: string; quantity: number }[] {
  return drops.map(drop => ({ itemId: drop.itemId,
    quantity: drop.min + Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, random())) * (drop.max - drop.min + 1)) }))
    .filter(stack => stack.quantity > 0)
}

export function patrolAttackKind(settings: Pick<PatrolCombatSettings, 'meleeRange' | 'levelTolerance' | 'ranged'>,
  distance: number, provoked: boolean, heightDifference = 0): PatrolAttack | undefined {
  const range = Math.abs(distance)
  const height = Math.abs(heightDifference)
  if (settings.ranged && provoked && range <= settings.ranged.range && height <= settings.ranged.heightTolerance) return 'shot'
  return range <= settings.meleeRange && height <= settings.levelTolerance ? 'melee' : undefined
}

/** Fear accrues in gameplay time; notice damage fires once on each new detection. */
export class MonsterFear {
  private noticed = false
  private accrued = 0
  private readonly settings: FearSettings
  constructor(settings: FearSettings) { this.settings = settings }
  affects(source: { x: number; y: number }, target: HeroTarget, active: boolean): boolean {
    return active && target.available && Math.hypot(source.x - target.x, source.y - target.y) <= this.settings.radius
  }
  reset(): void { this.noticed = false; this.accrued = 0 }
  update(deltaMs: number, source: { x: number; y: number }, target: HeroTarget, detected: boolean, active: boolean): number {
    if (!active || !target.available) { this.reset(); return 0 }
    let damage = detected && !this.noticed ? this.settings.noticeSanityDamage : 0
    this.noticed = detected
    if (this.affects(source, target, active)) {
      this.accrued += this.settings.sanityPerSecond * Math.max(0, deltaMs) / 1000
      const whole = Math.floor(this.accrued + 1e-9)
      damage += whole
      this.accrued -= whole
    } else this.accrued = 0
    return damage
  }
}

export function monsterAttackSanityDamage(healthDamage: number): number {
  return Number.isFinite(healthDamage) ? Math.max(0, healthDamage) / 2 : 0
}

/** Fear includes aura, notice shocks and the sanity portion of monster attacks. */
export function fearDamage(amount: number, resistancePercent: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const resistance = Number.isFinite(resistancePercent) ? Math.max(0, Math.min(100, resistancePercent)) : 0
  return amount * (1 - resistance / 100)
}

/** Daytime patrols detect the hero only while a fight is active; hidden targets stay undetectable. */
export function detectsHero(patrol: { x: number; y: number }, target: HeroTarget, radius: number, night: boolean, inCombat = false, monster = false): boolean {
  return (monster || night && !target.patrolPass || inCombat) && target.available && Math.hypot(patrol.x - target.x, patrol.y - target.y) <= radius
}

export function closestPatrol<T extends PatrolTarget>(origin: CombatPosition, targets: readonly T[],
  attack: 'melee' | 'shot', meleeRange: number, levelTolerance: number): T | undefined {
  let selected: T | undefined
  let nearest = Infinity
  for (const target of targets) {
    if (!target.visible || target.health <= 0 || Math.abs(target.y - origin.y) > levelTolerance) continue
    const distance = (target.x - origin.x) ** 2 + (target.y - origin.y) ** 2
    if (attack === 'melee') {
      const a = origin.bounds, b = target.bounds
      if (Math.abs(target.x - origin.x) > meleeRange || a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom) continue
    }
    if (distance < nearest) { selected = target; nearest = distance }
  }
  return selected
}

/** Attacks start in gameplay time; damage is resolved only after animation completion. */
export class PatrolCombat {
  health: number
  aggressive = false
  private cooldownMs = 0
  private attackPending?: PatrolAttack
  private readonly settings: PatrolCombatSettings

  constructor(settings: PatrolCombatSettings) { this.settings = settings; this.health = settings.health }

  engage(): void {
    if (this.health <= 0 || this.aggressive) return
    this.cooldownMs = this.settings.reactionDelayMs
    this.aggressive = true
  }

  disengage(): void {
    this.aggressive = false
    this.cooldownMs = 0
    this.cancelAttack()
  }

  receiveDamage(amount: number): boolean {
    if (this.health <= 0 || !Number.isFinite(amount) || amount <= 0) return false
    this.health = Math.max(0, this.health - amount)
    if (this.health === 0) this.cancelAttack()
    this.engage()
    return true
  }

  update(deltaMs: number, inRange: boolean, targetAvailable: boolean, kind: PatrolAttack = 'melee'): number {
    if (this.health <= 0 || !this.aggressive || !targetAvailable) return 0
    this.cooldownMs = Math.max(0, this.cooldownMs - Math.max(0, deltaMs))
    if (!inRange || this.cooldownMs > 0 || this.attackPending) return 0
    if (kind === 'shot' && !this.settings.ranged) return 0
    this.cooldownMs = this.settings.attackCooldownMs
    this.attackPending = kind
    return kind === 'shot' ? this.settings.ranged!.damage : this.settings.meleeDamage
  }

  finishAttack(inRange: boolean, targetAvailable: boolean): number {
    const pending = this.attackPending
    this.attackPending = undefined
    return pending && this.health > 0 && inRange && targetAvailable
      ? pending === 'shot' ? this.settings.ranged!.damage : this.settings.meleeDamage : 0
  }

  cancelAttack(): void { this.attackPending = undefined }
}
