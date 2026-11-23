import { calculateSkills } from '../skills/character.ts'
import type { Attributes, Character } from '../skills/character'
import type { ConsumableBuffDefinition, PerkDefinition } from './perkTypes'

/**
 * Apply active attribute buffs to a copied base and clamp negative values.
 * @param {Attributes} base - Base attributes including habit adjustments.
 * @param {readonly ConsumableBuffDefinition[]} buffs - Active consumable buffs.
 * @returns {Attributes} A new nonnegative attribute record.
 */
export function buffAttributes(
  base: Attributes,
  buffs: readonly ConsumableBuffDefinition[],
): Attributes {
  const attributes = { ...base }

  for (const buff of buffs) {
    if (buff.attribute) attributes[buff.attribute] += buff.amount
  }

  for (const key of Object.keys(attributes) as (keyof Attributes)[]) {
    attributes[key] = Math.max(0, attributes[key])
  }

  return attributes
}

/**
 * Combine skill adjustments from active buffs and acquired perks.
 * @param {readonly ConsumableBuffDefinition[]} buffs - Active consumable buffs.
 * @param {readonly PerkDefinition[]} perks - Acquired perk definitions.
 * @returns {Partial<Character['skills']>} Additive modifiers by skill.
 */
export function collectSkillModifiers(
  buffs: readonly ConsumableBuffDefinition[],
  perks: readonly PerkDefinition[],
): Partial<Character['skills']> {
  const modifiers: Partial<Character['skills']> = {}

  for (const buff of buffs) {
    if (buff.skill) {
      modifiers[buff.skill] = (modifiers[buff.skill] ?? 0) + buff.amount
    }
  }

  for (const perk of perks) {
    for (const [key, amount] of Object.entries(perk.skillModifiers ?? {})) {
      const skill = key as keyof Character['skills']
      modifiers[skill] = (modifiers[skill] ?? 0) + amount
    }
  }

  return modifiers
}

/**
 * Calculate attribute-derived skills and apply additive modifiers.
 * @param {Attributes} attributes - Effective nonnegative attributes.
 * @param {Partial<Skills>} modifiers - Additive skill adjustments.
 * @returns {Character['skills']} Skills clamped to a minimum of one.
 */
export function modifiedSkills(
  attributes: Attributes,
  modifiers: Partial<Character['skills']>,
): Character['skills'] {
  const skills = calculateSkills(attributes)

  for (const key of Object.keys(skills) as (keyof typeof skills)[]) {
    skills[key] = Math.max(1, skills[key] + (modifiers[key] ?? 0))
  }

  return skills
}
