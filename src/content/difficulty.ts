import config from './difficulty.json' with { type: 'json' }
import { HERO_SETTINGS } from './hero.ts'
import { UI_CONFIG } from './ui.ts'
import { DAYTIME_CONFIG } from './daytime.ts'
import { resolveDifficulty } from '../domain/character/difficulty.ts'
import type { BalanceBase } from '../domain/character/difficulty'

export const DIFFICULTIES = config
export function difficultyRules(id = config.defaultId) {
  return resolveDifficulty(config, id, {
    hero: HERO_SETTINGS, stats: UI_CONFIG.stats as BalanceBase['stats'], rest: UI_CONFIG.rest, timeCosts: DAYTIME_CONFIG.statCostsPerPhase,
  })
}
