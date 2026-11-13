import { scaleItemBuff } from '../skills/effects.ts'
import type { Recovery } from '../inventory/items'
import { calculateSkills } from '../skills/character.ts'
import type { Attributes, Character } from '../skills/character'

export interface ConsumableBuffDefinition {
  group?: string
  id: string
  name: string
  description: string
  itemIds: readonly string[]
  attribute?: keyof Attributes
  vital?: 'health' | 'energy'
  damageResistance?: boolean
  fearResistance?: boolean
  amount: number
  durationDays: number
}

export const PERK_ACTIONS = ['lockPicked', 'policeHit', 'policeKilled', 'policeEngaged', 'itemSold', 'dialogueChosen', 'questFinished',
  'persuaded', 'intimidated', 'itemLooted', 'itemScrapped', 'policeFightStarted', 'policeEscaped', 'policeHidden',
  'monsterFightStarted', 'monsterEscaped', 'monsterHidden', 'adviceAsked', 'attackAboveHalf', 'attackBelowHalf'] as const
export type PerkAction = typeof PERK_ACTIONS[number]
export interface PerkDefinition {
  chargeDamage?: { start: number; full: number }
  actionPoints?: Partial<Record<PerkAction, number>>
  skillModifiers?: Partial<Record<keyof Character['skills'], number>>
  id: string
  group: string
  name: string
  description: string
  itemIds: readonly string[]
  goal: number
  sanityMultiplier: number
  withdrawalFraction: number
  willpowerOnUse: number
  willpowerAfterDay: number
  consumeAtMaximum: boolean
}
export interface PerksSnapshot {
  counts: Readonly<Record<string, number>>
  acquired: readonly string[]
  habits: Readonly<Record<string, { lastUse: number; lastPenalty: number; sanity: number; willpower?: number }>>
  buffs?: readonly { id: string; expiresAt: number }[]
}
export const emptyPerks = (): PerksSnapshot => ({ counts: {}, acquired: [], habits: {} })

/** Older saves could contain several item bundles in one category. Keep the latest. */
export function normalizeConsumableGroups(state: PerksSnapshot, definitions: readonly ConsumableBuffDefinition[]): PerksSnapshot {
  const entries = (state.buffs ?? []).map((active, index) => ({ active, index, definition: definitions.find(buff => buff.id === active.id) }))
  const sources = new Map<string, readonly string[]>()
  for (const entry of [...entries].sort((a,b) => b.active.expiresAt-a.active.expiresAt
    || (a.definition?.itemIds.length ?? 0)-(b.definition?.itemIds.length ?? 0) || b.index-a.index)) {
    const definition = entry.definition
    if (definition?.group && !sources.has(definition.group)) sources.set(definition.group, definition.itemIds)
  }
  return { ...state, ...(state.buffs ? { buffs: entries.filter(({definition}) => !definition?.group
    || definition.itemIds.some(id => sources.get(definition.group!)!.includes(id))).map(entry => entry.active) } : {}) }
}

export function progressForAction(state: PerksSnapshot, definitions: readonly PerkDefinition[], action: PerkAction): PerksSnapshot {
  let next = state
  for (const perk of definitions) {
    const points = perk.actionPoints?.[action]
    if (!points || definitions.some(other => other.group === perk.group && next.acquired.includes(other.id))) continue
    const count = Math.min(perk.goal, (next.counts[perk.id] ?? 0) + points)
    next = { ...next, counts: { ...next.counts, [perk.id]: count }, acquired: count === perk.goal ? [...next.acquired, perk.id] : next.acquired }
  }
  return next
}

export function buffFearResistance(state: PerksSnapshot, definitions: readonly ConsumableBuffDefinition[], multiplier = 1): number {
  return definitions.filter(buff => buff.fearResistance && state.buffs?.some(active => active.id === buff.id))
    .reduce((sum, buff) => sum + scaleItemBuff(buff.amount, multiplier), 0)
}

export function buffDamageResistance(state: PerksSnapshot, definitions: readonly ConsumableBuffDefinition[], multiplier = 1): number {
  return definitions.filter(buff => buff.damageResistance && state.buffs?.some(active => active.id === buff.id))
    .reduce((sum, buff) => sum + scaleItemBuff(buff.amount, multiplier), 0)
}

export function perkRecovery(state: PerksSnapshot, definitions: readonly PerkDefinition[], itemId: string, recovery: Recovery): Recovery {
  const perk = definitions.find(perk => state.acquired.includes(perk.id) && perk.itemIds.includes(itemId))
  return perk && recovery.sanity ? { ...recovery, sanity: recovery.sanity * perk.sanityMultiplier } : recovery
}

export function consumeForPerks(state: PerksSnapshot, definitions: readonly PerkDefinition[], itemId: string, sanity: number, tick: number): PerksSnapshot {
  let next = state
  for (const perk of definitions.filter(perk => perk.itemIds.includes(itemId))) {
    const count = Math.min(perk.goal, (next.counts[perk.id] ?? 0) + 1)
    const blocked = definitions.some(other => other.group === perk.group && next.acquired.includes(other.id))
    const acquired = count >= perk.goal && !blocked ? [...next.acquired, perk.id] : next.acquired
    next = { ...next, counts: { ...next.counts, [perk.id]: count }, acquired,
      habits: { ...next.habits, [perk.id]: { lastUse: tick, lastPenalty: tick, sanity,
        ...(acquired.includes(perk.id) ? { willpower: perk.willpowerOnUse } : {}) } } }
  }
  return next
}

export function expirePerks(state: PerksSnapshot, definitions: readonly PerkDefinition[], tick: number, phasesPerDay: number): PerksSnapshot {
  const habits = { ...state.habits }
  for (const perk of definitions.filter(perk => state.acquired.includes(perk.id))) {
    const habit = habits[perk.id]
    if (habit) habits[perk.id] = { ...habit, willpower: tick - habit.lastUse >= phasesPerDay ? perk.willpowerAfterDay : perk.willpowerOnUse }
  }
  return { ...state, habits, ...(state.buffs ? { buffs: state.buffs.filter(buff => buff.expiresAt > tick) } : {}) }
}

export function consumeForBuffs(state: PerksSnapshot, definitions: readonly ConsumableBuffDefinition[], itemId: string,
  tick: number, phasesPerDay: number): PerksSnapshot {
  const matching = definitions.filter(buff => buff.itemIds.includes(itemId))
  if (!matching.length) return state
  const buffs = new Map((state.buffs ?? []).map(buff => [buff.id, buff]))
  for (const buff of matching) if (buff.group) {
    for (const other of definitions) if (other.group === buff.group) buffs.delete(other.id)
  }
  for (const buff of matching) buffs.set(buff.id, { id: buff.id, expiresAt: tick + buff.durationDays * phasesPerDay })
  return { ...state, buffs: [...buffs.values()] }
}

/** Resolve the temporary base used by equipment/condition rules without mutating the character. */
export function perkCharacter(character: Character, state: PerksSnapshot, definitions: readonly ConsumableBuffDefinition[] = [], perks: readonly PerkDefinition[] = []): Character {
  const modifier = state.acquired.reduce((sum, id) => sum + (state.habits[id]?.willpower ?? 0), 0)
  const attributes = { ...character.baseAttributes, willpower: character.baseAttributes.willpower + modifier }
  for (const buff of definitions.filter(buff => state.buffs?.some(active => active.id === buff.id))) {
    if (buff.attribute) attributes[buff.attribute] += buff.amount
  }
  for (const key of Object.keys(attributes) as (keyof Attributes)[]) attributes[key] = Math.max(0, attributes[key])
  const skillModifiers: Partial<Character['skills']> = {}
  for (const perk of perks.filter(perk => state.acquired.includes(perk.id))) {
    for (const [key, amount] of Object.entries(perk.skillModifiers ?? {})) {
      const skill = key as keyof Character['skills']
      skillModifiers[skill] = (skillModifiers[skill] ?? 0) + amount
    }
  }
  const skills = calculateSkills(attributes)
  for (const key of Object.keys(skills) as (keyof typeof skills)[]) skills[key] = Math.max(1, skills[key] + (skillModifiers[key] ?? 0))
  return { ...character, baseAttributes: attributes, attributes, skills, skillModifiers }
}

/** Food increases capacity only; current points are preserved by StatusService.setLimits. */
export function buffVitals<T extends { id: string; max: number }>(stats: readonly T[], state: PerksSnapshot,
  definitions: readonly ConsumableBuffDefinition[], multiplier = 1): T[] {
  return stats.map(stat => ({ ...stat, max: stat.max + definitions.filter(buff => buff.vital === stat.id
    && state.buffs?.some(active => active.id === buff.id)).reduce((sum, buff) => sum + scaleItemBuff(buff.amount, multiplier), 0) }))
}

/** Four phases are one full elapsed game day, including skipped phases during sleep. */
export function perkWithdrawal(state: PerksSnapshot, definitions: readonly PerkDefinition[], tick: number, phasesPerDay: number): { state: PerksSnapshot; sanity: number } {
  let sanity = 0
  const habits = { ...state.habits }
  for (const perk of definitions.filter(perk => state.acquired.includes(perk.id))) {
    const habit = habits[perk.id]
    if (!habit) continue
    const days = Math.floor((tick - habit.lastPenalty) / phasesPerDay)
    if (days <= 0) continue
    sanity += days * habit.sanity * perk.withdrawalFraction
    habits[perk.id] = { ...habit, lastPenalty: habit.lastPenalty + days * phasesPerDay }
  }
  return { state: { ...state, habits }, sanity }
}

/** Interpolate acquired perk damage adjustments between the charge endpoints. */
export function perkChargeDamage(state: PerksSnapshot, definitions: readonly PerkDefinition[], charge: number): number {
  return definitions.filter(perk => state.acquired.includes(perk.id)).reduce((sum, perk) =>
    sum + (perk.chargeDamage ? perk.chargeDamage.start * (1 - charge) + perk.chargeDamage.full * charge : 0), 0)
}

export function chargePerkAction(charge: number, damage: number): PerkAction | undefined {
  if (!Number.isFinite(damage) || damage <= 0 || !Number.isFinite(charge) || charge < 0 || charge > 1 || charge === 0.5) return undefined
  return charge > 0.5 ? 'attackAboveHalf' : 'attackBelowHalf'
}
