import type { Character } from './character'
import { applyCarriedBonuses } from '../inventory/items.ts'
import type { InventoryItemDefinition } from '../inventory/items'
import type { ItemStack } from '../inventory/loot'
import config from '../../content/skills.json' with { type: 'json' }
import { legendarySkill, scaleItemBuff } from './effects.ts'
import { perkCharacter } from '../character/perks.ts'
import type { ConsumableBuffDefinition, PerkDefinition, PerksSnapshot } from '../character/perks'

type ConditionVitals = Readonly<{ energy: number; sanity: number }>
const ratio = (current: number, maximum: number, threshold: number): number => maximum > 0
  ? Math.max(0, Math.min(1, current / (maximum * threshold))) : 0
export function conditionMultipliers(vitals: ConditionVitals, limits: ConditionVitals): { energy: number; sanity: number } {
  return {
    energy: ratio(vitals.energy, limits.energy, config.conditionPenaltyThreshold),
    sanity: 1 - config.sanityPenaltyStrength * (1 - ratio(vitals.sanity, limits.sanity, config.sanityPenaltyThreshold)),
  }
}
/** Apply carried bonuses and condition-adjusted attributes before deriving skills. */
export function conditionedCharacter(character: Character, items: readonly ItemStack[],
  definitions: Readonly<Record<string, InventoryItemDefinition>>, vitals: ConditionVitals, limits: ConditionVitals, itemMultiplier = 1): Character {
  const { energy: energyMultiplier, sanity: sanityMultiplier } = conditionMultipliers(vitals, limits)
  return applyCarriedBonuses(character, items, definitions, 1, {
    strength: energyMultiplier, agility: energyMultiplier,
    charisma: sanityMultiplier, intelligence: sanityMultiplier,
  }, itemMultiplier)
}

/** Re-evaluate from unamplified items every time: a perk cannot sustain its own threshold. */
export function resolveItemCharacter(character: Character, items: readonly ItemStack[], definitions: Readonly<Record<string, InventoryItemDefinition>>,
  vitals: ConditionVitals, limits: ConditionVitals, state: PerksSnapshot, buffs: readonly ConsumableBuffDefinition[], perks: readonly PerkDefinition[],
  conditioned = true, activation?: Character['skills']): Character {
  let erudition = activation ? legendarySkill(activation, 'erudition') : false
  let medicine = activation ? legendarySkill(activation, 'medicine') : false
  let result = character
  for (let pass = 0; pass < 3; pass++) {
    const multiplier = erudition ? config.legendary.itemBuffMultiplier : 1
    const protectedPenalty = (buff: ConsumableBuffDefinition) => buff.amount < 0 && buff.itemIds.some(id =>
      (['Medical', 'Food', 'Drink'].includes(definitions[id]?.category ?? '') || id.endsWith('-cigarettes')))
    const cleanState = { ...state, habits: Object.fromEntries(Object.entries(state.habits).map(([id, habit]) => [id,
      (habit.willpower ?? 0) < 0 && perks.find(perk => perk.id === id)?.itemIds.some(itemId => ['Medical', 'Food', 'Drink'].includes(definitions[itemId]?.category ?? '') || itemId.endsWith('-cigarettes'))
        ? { ...habit, willpower: 0 } : habit])) }
    const effects = buffs.filter(buff => !(medicine && protectedPenalty(buff)))
      .map(buff => ({ ...buff, amount: scaleItemBuff(buff.amount, multiplier) }))
    const base = perkCharacter(character, medicine ? cleanState : state, effects, perks)
    result = conditioned ? conditionedCharacter(base, items, definitions, vitals, limits, multiplier)
      : applyCarriedBonuses(base, items, definitions, 1, 1, multiplier)
    if (activation) break
    const clean = perkCharacter(character, cleanState, effects.filter(buff => !protectedPenalty(buff)), perks)
    const cleanCharacter = conditioned ? conditionedCharacter(clean, items, definitions, vitals, limits, multiplier) : applyCarriedBonuses(clean, items, definitions, 1, 1, multiplier)
    const nextErudition = legendarySkill(result.skills, 'erudition'), nextMedicine = legendarySkill(cleanCharacter.skills, 'medicine')
    if (erudition === nextErudition && medicine === nextMedicine) break
    erudition = nextErudition; medicine = nextMedicine
  }
  return { ...result, baseAttributes: character.baseAttributes }
}
