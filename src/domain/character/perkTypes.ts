import type { Attributes, Character } from '../skills/character'

/**
 * Temporary item-triggered attribute, skill, vital or resistance bonus.
 */
export interface ConsumableBuffDefinition {
  group?: string
  id: string
  name: string
  description: string
  itemIds: readonly string[]
  attribute?: keyof Attributes
  skill?: keyof Character['skills']
  vital?: 'health' | 'energy' | 'sanity'
  damageResistance?: boolean
  fearResistance?: boolean
  amount: number
  durationDays: number
}

export const PERK_ACTIONS = [
  'chaseHidden',
  'gunDefeat',
  'meleeDefeat',
  'wellTrainedFinished',
  'lockPicked',
  'policeHit',
  'policeKilled',
  'policeEngaged',
  'itemSold',
  'dialogueChosen',
  'questFinished',
  'persuaded',
  'intimidated',
  'itemLooted',
  'itemScrapped',
  'policeFightStarted',
  'policeEscaped',
  'policeHidden',
  'monsterFightStarted',
  'monsterEscaped',
  'monsterHidden',
  'adviceAsked',
  'attackAboveHalf',
  'attackBelowHalf'
] as const
export type PerkAction = typeof PERK_ACTIONS[number]
/**
 * Authored perk progression, competing group and acquired effects.
 */
export interface PerkDefinition {
  chargeDamage?: {
    start: number
    full: number
  }
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
/**
 * Persistable perk counts, acquired IDs, habit timing and temporary buffs.
 */
export interface PerksSnapshot {
  counts: Readonly<Record<string, number>>
  acquired: readonly string[]
  habits: Readonly<Record<string, {
    lastUse: number
    lastPenalty: number
    sanity: number
    willpower?: number
  }>>
  buffs?: readonly {
    id: string
    expiresAt: number
  }[]
}
