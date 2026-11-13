import { ITEM_RARITIES } from '../../../domain/inventory/items.ts'
import { ATTRIBUTE_LABELS,SKILL_LABELS } from '../../../domain/skills/character.ts'
import { EFFECT_SKILLS } from '../../../domain/skills/effects.ts'
import { array,choice,number,object,text } from '../schema.ts'
import { positive,stack } from './common.ts'
export const skillsSchema = object({ ...Object.fromEntries(EFFECT_SKILLS.map(key => [key, number(0)])),
    persuasionTrustPoints: number(1, true),
    attributeWeights: object(Object.fromEntries(Object.keys(SKILL_LABELS).map(skill => [skill,
      object(Object.fromEntries(Object.keys(ATTRIBUTE_LABELS).map(attribute => [attribute, number(0, true, 3)]))),
    ]))),
    legendary: object({ threshold: number(1, true), rangedMultiplier: positive, sneakMultiplier: positive, enemyAttackSpeed: number(Number.MIN_VALUE, false, 1), itemBuffMultiplier: positive,
      barter: object({ vendorId: text, minItems: number(1, true), maxItems: number(1, true), ammunition: object({ itemId: text, quantity: number(1, true) }) }),
      scrapping: object({ itemChance: number(0, false, 1), fallbackReward: object({ itemId: text, minQuantity: number(1, true), maxQuantity: number(1, true) }) }),
      perks: array(object({ skill: choice(...Object.keys(SKILL_LABELS)), description: text }), true) }),
    lockpickingMaxSumByRarity: object(Object.fromEntries(ITEM_RARITIES.map(rarity => [rarity, number(4, true, 27)]))),
    scrapping: object({ baseChance: number(0, false, 1), chancePerPoint: number(0), maxChance: number(0, false, 1), rarityWeights: object(Object.fromEntries(ITEM_RARITIES.map(rarity => [rarity, positive]))), rewards: array(stack, true) }),
    conditionPenaltyThreshold: number(Number.MIN_VALUE, false, 1),
    sanityPenaltyThreshold: number(Number.MIN_VALUE, false, 1), sanityPenaltyStrength: number(0, false, 1),
    lockpickingBaseSeconds: positive, lockpickingSecondsPerPoint: number(0) })
