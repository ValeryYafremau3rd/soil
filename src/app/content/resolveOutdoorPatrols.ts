import type { DayPhase } from '../contracts/daytime.ts'
import type { PatrolConfiguration } from '../../content/types.ts'

/**
 * Stable per day and phase: visiting another district cannot reroll the global headcount.
 * @param {PatrolConfiguration} config - Configuration consumed by this operation.
 * @param {string} locationId - The location id supplied to this operation.
 * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
 * @param {number} day - The day supplied to this operation.
 * @returns {{ definition: PatrolDefinition; location: PatrolLocation; count: number; }[]} The result described by the TypeScript return signature.
 */
export function resolveOutdoorPatrols(
  config: PatrolConfiguration,
  locationId: string,
  phase: DayPhase,
  day: number
) {
  const location = config.locations[locationId]
  if (!location || location.enabled === false) return []

  const locations = Object.keys(config.locations).filter(id => config.locations[id].enabled !== false).sort()

  return (location.outdoorSpawns ?? []).flatMap(entry => {
    let seed = day

    // Mixed patrol members use the same roll to arrive together.
    const rollKey = entry.chanceGroup ?? entry.type
    const seedKey = `${phase}:${rollKey}:${entry.shared ? 'shared' : locationId}`

    for (const char of seedKey) seed = Math.imul(seed, 31) + char.charCodeAt(0) | 0

    /**
     * Perform random.
     * @returns {number} The calculated numeric result.
     */
    const random = () => {
      seed = seed + 0x6d2b79f5 | 0
      let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
      value ^= value + Math.imul(value ^ value >>> 7, 61 | value)

      return ((value ^ value >>> 14) >>> 0) / 4294967296
    }
    if (random() >= entry.chance) return []

    let count = entry.counts[phase]
    if (entry.shared) {
      count = 0

      for (let index = 0;index < entry.counts[phase];index++) {
        if (locations[Math.floor(random() * locations.length)] === locationId) count++
      }
    }

    return count ? [{ definition: config.types[entry.type], location, count }] : []
  })
}
