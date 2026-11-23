import { ITEM_RARITIES } from '../../../domain/inventory/items.ts'
import { ATTRIBUTE_LABELS, SKILL_LABELS } from '../../../domain/skills/character.ts'
import { EFFECT_SKILLS } from '../../../domain/skills/effects.ts'
import { array, boolean, choice, number, object, optional, record, text } from '../schema.ts'
import { positive, stack } from './common.ts'
export const skillsSchema = object({
  ...Object.fromEntries(EFFECT_SKILLS.map(key => [key, number(0)])),
  vehicleSearch: object({
    stealth: positive,
    lockpicking: positive,
    athletics: positive,
    scraper: positive,
    barter: positive,
    parts: array(stack, true),
    valuables: array(stack, true)
  }),
  educationRequirementReduction: number(0, false, 1),
  doorLocks: optional(record(object({
    locked: optional(boolean),
    keyOnly: optional(boolean),
    rarity: optional(choice(...ITEM_RARITIES))
  }))),
  persuasionTrustPoints: number(1, true),
  questMoneyWeights: object({ barter: number(0), intimidation: number(0), persuasion: number(0) }),
  attributeWeights: object(Object.fromEntries(Object.keys(SKILL_LABELS).map(skill => [
    skill,
    object(Object.fromEntries(Object.keys(ATTRIBUTE_LABELS).map(attribute => [attribute, number(0, true, 3)]))),
  ]))),
  legendary: object({
    allSkillsBonus: number(1, true),
    threshold: number(1, true),
    rangedMultiplier: positive,
    sneakMultiplier: positive,
    enemyAttackSpeed: number(Number.MIN_VALUE, false, 1),
    itemBuffMultiplier: positive,
    barter: object({
      freeCategories: array(choice('Food', 'Drink', 'Medical'), true),
      freeItemIds: array(text, true),
      vendorId: text,
      minItems: number(1, true),
      maxItems: number(1, true),
      ammunition: object({ itemId: text, quantity: number(1, true) })
    }),
    scrapping: object({
      bonusChance: number(0, false, 1),
      fallbackReward: object({ itemId: text, minQuantity: number(1, true), maxQuantity: number(1, true) })
    }),
    perks: array(object({ skill: choice(...Object.keys(SKILL_LABELS)), description: text }), true)
  }),
  lockpickingMaxSumByRarity: object(Object.fromEntries(ITEM_RARITIES.map(rarity => [rarity, number(4, true, 27)]))),
  scrapping: object({
    baseChance: number(0, false, 1),
    chancePerPoint: number(0),
    maxChance: number(0, false, 1),
    rarityWeights: object(Object.fromEntries(ITEM_RARITIES.map(rarity => [rarity, positive]))),
    rewards: array(stack, true)
  }),
  conditionPenaltyThreshold: number(Number.MIN_VALUE, false, 1),
  sanityPenaltyThreshold: number(Number.MIN_VALUE, false, 1),
  sanityPenaltyStrength: number(0, false, 1),
  lockpickingBaseSeconds: positive,
  lockpickingSecondsPerPoint: number(0)
})
