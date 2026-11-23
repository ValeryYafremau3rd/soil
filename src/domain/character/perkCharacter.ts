import { scaleItemBuff } from '../skills/effects.ts'
import {
  buffAttributes,
  collectSkillModifiers,
  modifiedSkills,
} from './perkCharacterEffects.ts'
import type { Character } from '../skills/character'
import type {
  ConsumableBuffDefinition,
  PerkDefinition,
  PerksSnapshot,
} from './perkTypes'

/**
 * Build a temporary base for equipment and condition rules without mutation.
 * @param {Character} character - Original character and base attributes.
 * @param {PerksSnapshot} state - Acquired perks, habits and active buffs.
 * @param {readonly ConsumableBuffDefinition[]} definitions - Available buffs.
 * @param {readonly PerkDefinition[]} perks - Available perk definitions.
 * @returns {Character} A copied character with adjusted attributes and skills.
 */
export function perkCharacter(
  character: Character,
  state: PerksSnapshot,
  definitions: readonly ConsumableBuffDefinition[] = [],
  perks: readonly PerkDefinition[] = [],
): Character {
  const modifier = state.acquired.reduce(
    (sum, id) => sum + (state.habits[id]?.willpower ?? 0),
    0,
  )
  const activeBuffs = definitions.filter(buff =>
    state.buffs?.some(active => active.id === buff.id),
  )
  const attributes = buffAttributes({
    ...character.baseAttributes,
    willpower: character.baseAttributes.willpower + modifier,
  }, activeBuffs)
  const acquiredPerks = perks.filter(perk => state.acquired.includes(perk.id))
  const skillModifiers = collectSkillModifiers(activeBuffs, acquiredPerks)
  const skills = modifiedSkills(attributes, skillModifiers)

  return { ...character, baseAttributes: attributes, attributes, skills, skillModifiers }
}

/**
 * Add food capacity bonuses; StatusService.setLimits preserves current points.
 * @template T - A vital record containing an identifier and maximum.
 * @param {readonly T[]} stats - Original vital capacities.
 * @param {PerksSnapshot} state - Current active buffs.
 * @param {readonly ConsumableBuffDefinition[]} definitions - Available buffs.
 * @param {number} multiplier - Scaling applied to each bonus.
 * @returns {T[]} Copied vital records with adjusted maximum capacities.
 */
export function buffVitals<T extends {
  id: string
  max: number
}>(
  stats: readonly T[],
  state: PerksSnapshot,
  definitions: readonly ConsumableBuffDefinition[],
  multiplier = 1,
): T[] {
  return stats.map(stat => {
    const bonus = definitions
      .filter(buff =>
        buff.vital === stat.id
        && state.buffs?.some(active => active.id === buff.id),
      )
      .reduce((sum, buff) => sum + scaleItemBuff(buff.amount, multiplier), 0)

    return { ...stat, max: stat.max + bonus }
  })
}

