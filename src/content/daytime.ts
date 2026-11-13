import config from './daytime.json' with { type: 'json' }
import type { DayPhase } from '../app/contracts/daytime'

export const DAYTIME_CONFIG = { ...config, initialPhase: config.initialPhase as DayPhase }
