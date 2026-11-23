import type { Character } from './character'
import { applyCarriedBonuses } from '../inventory/items.ts'
import type { InventoryItemDefinition } from '../inventory/items'
import type { ItemStack } from '../inventory/loot'
import config from '../../content/skills.json' with { type: 'json' }
import { legendarySkill, scaleItemBuff } from './effects.ts'
import { perkCharacter } from '../character/perks.ts'
import type { ConsumableBuffDefinition, PerkDefinition, PerksSnapshot } from '../character/perks'

type ConditionVitals = Readonly<{
  energy: number
  sanity: number
}>

/**
 * Perform ratio.
 * @param {number} current - The current supplied to this operation.
 * @param {number} maximum - The maximum supplied to this operation.
 * @param {number} threshold - The threshold supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
const ratio = (current: number, maximum: number, threshold: number): number => maximum > 0
  ? Math.max(0, Math.min(1, current / (maximum * threshold))) : 0

/**
 * Perform condition multipliers.
 * @param {Readonly<{ energy: number; sanity: number; }>} vitals - The vitals supplied to this operation.
 * @param {Readonly<{ energy: number; sanity: number; }>} limits - The limits supplied to this operation.
 * @returns {{ energy: number; sanity: number; }} The result described by the TypeScript return signature.
 */
export function conditionMultipliers(
  vitals: ConditionVitals,
  limits: ConditionVitals
): {
  energy: number
  sanity: number
} {
  return {
    energy: ratio(vitals.energy, limits.energy, config.conditionPenaltyThreshold),
    sanity: 1 - config.sanityPenaltyStrength * (1 - ratio(vitals.sanity, limits.sanity, config.sanityPenaltyThreshold)),
  }
}

/**
 * Energy adjusts all attributes before derivation; Sanity adjusts the resulting skills.
 * @param {Character} character - Character whose attributes and skills are used.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {Readonly<Record<string, InventoryItemDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {Readonly<{ energy: number; sanity: number; }>} vitals - The vitals supplied to this operation.
 * @param {Readonly<{ energy: number; sanity: number; }>} limits - The limits supplied to this operation.
 * @param {number} itemMultiplier - The item multiplier supplied to this operation.
 * @returns {Character} The result described by the TypeScript return signature.
 */
export function conditionedCharacter(
  character: Character,
  items: readonly ItemStack[],
  definitions: Readonly<Record<string, InventoryItemDefinition>>,
  vitals: ConditionVitals,
  limits: ConditionVitals,
  itemMultiplier = 1
): Character {
  const { energy: energyMultiplier, sanity: sanityMultiplier } = conditionMultipliers(vitals, limits)

  return applyCarriedBonuses(
    character,
    items,
    definitions,
    sanityMultiplier,
    energyMultiplier,
    itemMultiplier
  )
}

/**
 * Re-evaluate from unamplified items every time: a perk cannot sustain its own threshold.
 * @param {Character} character - Character whose attributes and skills are used.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {Readonly<Record<string, InventoryItemDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {Readonly<{ energy: number; sanity: number; }>} vitals - The vitals supplied to this operation.
 * @param {Readonly<{ energy: number; sanity: number; }>} limits - The limits supplied to this operation.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly ConsumableBuffDefinition[]} buffs - The buffs supplied to this operation.
 * @param {readonly PerkDefinition[]} perks - The perks supplied to this operation.
 * @param {boolean} conditioned - The conditioned supplied to this operation.
 * @param {Skills | undefined} activation - The activation supplied to this operation.
 * @returns {Character} The result described by the TypeScript return signature.
 */
export function resolveEffectiveCharacter(
  character: Character,
  items: readonly ItemStack[],
  definitions: Readonly<Record<string, InventoryItemDefinition>>,
  vitals: ConditionVitals,
  limits: ConditionVitals,
  state: PerksSnapshot,
  buffs: readonly ConsumableBuffDefinition[],
  perks: readonly PerkDefinition[],
  conditioned = true,
  activation?: Character['skills']
): Character {
  let erudition = activation ? legendarySkill(activation, 'erudition') : false
  let medicine = activation ? legendarySkill(activation, 'medicine') : false
  let result = character

  for (let pass = 0;pass < 3;pass++) {
    const multiplier = erudition ? config.legendary.itemBuffMultiplier : 1

    /**
     * Perform protected penalty.
     * @param {ConsumableBuffDefinition} buff - The buff supplied to this operation.
     * @returns {boolean} Whether the requested condition is satisfied.
     */
    const protectedPenalty = (buff: ConsumableBuffDefinition) => buff.amount < 0 && buff.itemIds.some(id =>
      (['Medical', 'Food', 'Drink'].includes(definitions[id]?.category ?? '') || id.endsWith('-cigarettes')))
    const cleanState = {
      ...state,
      habits: Object.fromEntries(Object.entries(state.habits).map(([id, habit]) => [
        id,
        (habit.willpower ?? 0) < 0 && perks.find(perk => perk.id === id)?.itemIds.some(itemId => ['Medical', 'Food', 'Drink'].includes(definitions[itemId]?.category ?? '') || itemId.endsWith('-cigarettes'))
          ? { ...habit, willpower: 0 } : habit
      ]))
    }
    const effects = buffs.filter(buff => !(medicine && protectedPenalty(buff)))
      .map(buff => ({ ...buff, amount: scaleItemBuff(buff.amount, multiplier) }))
    const base = perkCharacter(character, medicine ? cleanState : state, effects, perks)
    result = conditioned ? conditionedCharacter(base, items, definitions, vitals, limits, multiplier)
      : applyCarriedBonuses(base, items, definitions, 1, 1, multiplier)
    if (activation) break

    const clean = perkCharacter(
      character,
      cleanState,
      effects.filter(buff => !protectedPenalty(buff)),
      perks
    )
    const cleanCharacter = conditioned ? conditionedCharacter(clean, items, definitions, vitals, limits, multiplier) : applyCarriedBonuses(clean, items, definitions, 1, 1, multiplier)
    const nextErudition = legendarySkill(result.skills, 'erudition'), nextMedicine = legendarySkill(cleanCharacter.skills, 'medicine')
    if (erudition === nextErudition && medicine === nextMedicine) break

    erudition = nextErudition
    medicine = nextMedicine
  }
  // Check the unboosted result so the perk cannot sustain its own activation.
  if (erudition) result = {
    ...result,
    skills: Object.fromEntries(Object.entries(result.skills)
      .map(([skill, value]) => [skill, value + config.legendary.allSkillsBonus])) as Character['skills']
  }

  return { ...result, baseAttributes: character.baseAttributes }
}
