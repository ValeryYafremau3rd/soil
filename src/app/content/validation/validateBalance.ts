import { ADVICE_RARITIES } from '../../../domain/dialogue/dialogue.ts'
import { requireCondition,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validateBalance(context: ContentContext) {
  const { advice, weights, difficulty } = context
unique(advice.entries.map(entry => entry.id), 'advice.json.entries')
requireCondition(advice.entries.some(entry => entry.level === 1), 'advice.json.entries: requires level 1 advice')
for (const rarity of ADVICE_RARITIES) requireCondition(advice.entries.some(entry => entry.rarity === rarity),
    `advice.json.entries: missing ${rarity} advice`)
for (const [skill, attributes] of Object.entries(weights)) {
    requireCondition(Object.values(attributes).reduce((total, weight) => total + weight, 0) === 3,
      `skills.json.attributeWeights.${skill}: weights must total 3`)
  }
unique(difficulty.presets.map(preset => preset.id), 'difficulty.json.presets')
requireCondition(difficulty.presets.length === 3, 'difficulty.json.presets: requires three presets')
requireCondition(difficulty.presets.some(preset => preset.id === difficulty.defaultId), 'difficulty.json.defaultId: unknown preset')
}
