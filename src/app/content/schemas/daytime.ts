import { ITEM_RARITIES } from '../../../domain/inventory/items.ts'
import { DAY_PHASES } from '../../contracts/daytime.ts'
import { choice, number, object, text } from '../schema.ts'
import { integer, positive, rect } from './common.ts'
export const daytimeSchema = object({
  initialLocationId: text,
  initialPhaseTravels: integer,
  initialDay: number(1, true),
  initialPhase: choice(...DAY_PHASES),
  travelsPerPhase: number(1, true),
  busFare: number(0, true),
  nightDurationMultiplier: number(1, true),
  sleepDeprivation: object({ gracePhases: integer, sanityPerPhase: number(0) }),
  courierJobsPerDay: object({ min: number(1, true), max: number(1, true) }),
  findItemMaxPrice: positive,
  findItemRewardMultipliers: object(Object.fromEntries(ITEM_RARITIES.map(rarity => [rarity, number(2, false, 2)]))),
  statCostsPerPhase: object({ energy: number(0), sanity: number(0) }),
  iconSheet: object({ path: text, width: positive, height: positive }),
  phases: object(Object.fromEntries(DAY_PHASES.map(phase => [
    phase,
    object({
      label: text,
      icon: rect,
      filter: object({ color: number(0, true, 16777215), alpha: number(0, false, 1) })
    }),
  ]))),
})
