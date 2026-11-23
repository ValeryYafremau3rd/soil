import type { DayPhase } from '../contracts/daytime'
import type { PatrolConfiguration } from '../../content/types'

/**
 * Resolve patrol population from the supplied state.
 * @param {PatrolConfiguration} config - Configuration consumed by this operation.
 * @param {string} locationId - The location id supplied to this operation.
 * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
 * @returns {{ definition: PatrolDefinition; location: PatrolLocation; count: number; } | undefined} The result described by the TypeScript return signature.
 */
export function resolvePatrolPopulation(
  config: PatrolConfiguration,
  locationId: string,
  phase: DayPhase
) {
  const location = config.locations[locationId]
  if (!location || location.enabled === false) return undefined

  const count = location.counts[phase]

  return count > 0 ? { definition: config.types[location.type], location, count } : undefined
}

/**
 * Roll once per population creation, never once per update or once per officer.
 * @param {PatrolConfiguration} config - Configuration consumed by this operation.
 * @param {string} locationId - The location id supplied to this operation.
 * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
 * @param {() => number} random - Random-number source; injectable for deterministic results.
 * @returns {{ definition: PatrolDefinition; location: PatrolLocation; count: number; } | undefined} The result described by the TypeScript return signature.
 */
export function resolvePatrolEncounter(
  config: PatrolConfiguration,
  locationId: string,
  phase: DayPhase,
  random: () => number
) {
  const population = resolvePatrolPopulation(config, locationId, phase)
  const encounters = population?.location.nightEncounters
  if (!population || phase !== 'night' || !encounters?.length) return population

  const total = encounters.reduce((sum, encounter) => sum + encounter.weight, 0)
  const roll = random() * total
  let boundary = 0

  for (const encounter of encounters) {
    boundary += encounter.weight
    if (roll < boundary) return { ...population, definition: config.types[encounter.type], count: encounter.count }
  }

  const last = encounters[encounters.length - 1]!

  return { ...population, definition: config.types[last.type], count: last.count }
}

/**
 * Resolve indoor patrol populations from the supplied state.
 * @param {PatrolConfiguration} config - Configuration consumed by this operation.
 * @param {string} locationId - The location id supplied to this operation.
 * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
 * @returns {{ definition: PatrolDefinition; location: IndoorPatrolLocation; count: number; }[]} The result described by the TypeScript return signature.
 */
export function resolveIndoorPatrolPopulations(
  config: PatrolConfiguration,
  locationId: string,
  phase: DayPhase
) {
  const location = config.locations[locationId]
  if (!location || location.enabled === false) return []

  return (location.interiors ?? []).filter(entry => entry.enabled !== false && entry.counts[phase] > 0)
    .map(entry => ({ definition: config.types[entry.type], location: entry, count: entry.counts[phase] }))
}

/**
 * World-space bounds and interior context used to place patrol actors.
 */
export interface PatrolSpace {
  buildingId: string
  roomId?: string
  floor: number
  groundY: number
  bounds: {
    left: number
    right: number
  }
  clearance: number
}

/**
 * One roll per empty room or whole building when the nighttime population is created.
 * @param {PatrolConfiguration} config - Configuration consumed by this operation.
 * @param {string} locationId - The location id supplied to this operation.
 * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
 * @param {readonly PatrolSpace[]} spaces - The spaces supplied to this operation.
 * @param {readonly { buildingId?: string | undefined; roomId?: string | undefined; }[]} occupants - The occupants supplied to this operation.
 * @param {() => number} random - Random-number source; injectable for deterministic results.
 * @param {{ buildingId?: string | undefined; roomId?: string | undefined; }} heroContext - The hero context supplied to this operation.
 * @returns {{ definition: PatrolDefinition; space: PatrolSpace; }[]} The result described by the TypeScript return signature.
 */
export function resolveEmptyInteriorSpawns(
  config: PatrolConfiguration,
  locationId: string,
  phase: DayPhase,
  spaces: readonly PatrolSpace[],
  occupants: readonly {
    buildingId?: string
    roomId?: string
  }[],
  random: () => number,
  heroContext: {
    buildingId?: string
    roomId?: string
  } = {}
) {
  const location = config.locations[locationId]
  const spawn = location?.emptyInteriorSpawn
  if (!location || location.enabled === false || phase !== 'night' || !spawn) return []

  return spaces.filter(space => {
    // Reserved rooms stay safe even while the hero is elsewhere.
    if (spawn.excludedRooms?.some(room => room.buildingId === space.buildingId && room.roomId === space.roomId)) return false

    if (!space.roomId && spaces.some(other => other.buildingId === space.buildingId && (other.roomId || other.floor < space.floor))) return false

    if (occupants.some(npc => npc.buildingId === space.buildingId && (!space.roomId || npc.roomId === space.roomId))) return false

    if (heroContext.buildingId === space.buildingId && (!space.roomId || heroContext.roomId === space.roomId)) return false

    const building = spawn.buildings?.find(entry => entry.buildingId === space.buildingId)
    return random() < (building?.chance ?? spawn.chance)
  }).map(space => {
    const building = spawn.buildings?.find(entry => entry.buildingId === space.buildingId)
    const types = building?.types
    const type = types
      ? types[Math.min(types.length - 1, Math.floor(random() * types.length))] : spawn.type

    return { definition: config.types[type], space }
  })
}
