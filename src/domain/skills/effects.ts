import type { Character } from './character'
import config from '../../content/skills.json' with { type: 'json' }

export function legendarySkill(skills: Partial<Character['skills']>, skill: keyof Character['skills']): boolean {
  return Number.isFinite(skills[skill]) && (skills[skill] ?? 0) >= config.legendary.threshold
}

export function legendaryAttackMultiplier(skills: Partial<Character['skills']>, kind: 'melee' | 'shot', inMeleeRange: boolean, fighting: boolean): number {
  return (kind === 'shot' && legendarySkill(skills, 'weapons') && !inMeleeRange ? config.legendary.rangedMultiplier : 1)
    * (legendarySkill(skills, 'stealth') && !fighting ? config.legendary.sneakMultiplier : 1)
}

export function interruptsAttack(skills: Partial<Character['skills']>, charge: number, random = Math.random): boolean {
  if (!legendarySkill(skills, 'martialArts') || !Number.isFinite(charge)) return false
  const chance = Math.max(0, Math.min(1, charge))
  return chance > 0 && (chance === 1 || random() < chance)
}

export function itemBuffMultiplier(skills: Partial<Character['skills']>): number {
  return legendarySkill(skills, 'erudition') ? config.legendary.itemBuffMultiplier : 1
}

/** Erudition boosts only books, rounding each positive bonus down. */
export function scaleItemBuff(amount: number, multiplier: number, category?: string): number {
  return category === 'Book' && amount > 0 && multiplier > 1 ? Math.floor(amount * multiplier) : amount
}

export const EFFECT_SKILLS = ['athletics', 'weapons', 'martialArts', 'stealth', 'medicine', 'barter'] as const
export type SkillEffectConfig = Record<typeof EFFECT_SKILLS[number], number>

export function resolveSkillEffects(skills: Partial<Character['skills']>, rates: SkillEffectConfig) {
  const bonus = (key: keyof SkillEffectConfig) => Math.max(0, skills[key] ?? 0) * rates[key]
  return {
    movement: 1 + bonus('athletics'),
    rangedDamage: 1 + bonus('weapons'),
    meleeDamage: 1 + bonus('martialArts'),
    detection: Math.max(0, 1 - bonus('stealth')),
    recovery: 1 + bonus('medicine'),
    buyPrice: 1,
    sellPrice: Math.min(1, bonus('barter')),
  }
}
export type SkillEffects = ReturnType<typeof resolveSkillEffects>
