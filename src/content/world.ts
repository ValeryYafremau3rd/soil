import config from './settings.json' with { type: 'json' }
import { HERO_SETTINGS } from './hero.ts'
import { interiorClearance } from '../domain/buildings/navigation.ts'
export const WORLD_LAYERS = config.layers
export const GAME_SETTINGS = config
export const MINIMUM_INTERIOR_HEIGHT = interiorClearance(0, config.interaction.minimumInteriorHeight,
  HERO_SETTINGS.frameHeight * HERO_SETTINGS.scale, config.interaction.interiorHeadroom)
