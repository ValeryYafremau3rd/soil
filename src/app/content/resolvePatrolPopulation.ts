import type { DayPhase } from '../contracts/daytime'
import type { PatrolConfiguration } from '../../content/types'

export function resolvePatrolPopulation(config: PatrolConfiguration, locationId: string, phase: DayPhase) {
  const location = config.locations[locationId]
  if (!location || location.enabled === false) return undefined
  const count = location.counts[phase]
  return count > 0 ? { definition: config.types[location.type], location, count } : undefined
}

/** Roll once per population creation, never once per update or once per officer. */
export function resolvePatrolEncounter(config: PatrolConfiguration, locationId: string, phase: DayPhase, random: () => number) {
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

export function resolveIndoorPatrolPopulations(config: PatrolConfiguration, locationId: string, phase: DayPhase) {
  const location = config.locations[locationId]
  if (!location || location.enabled === false) return []
  return (location.interiors ?? []).filter(entry => entry.enabled !== false && entry.counts[phase] > 0)
    .map(entry => ({ definition: config.types[entry.type], location: entry, count: entry.counts[phase] }))
}

export interface PatrolSpace {
  buildingId: string
  roomId?: string
  floor: number
  groundY: number
  bounds: { left: number; right: number }
  clearance: number
}

/** One roll per empty room or whole building when the nighttime population is created. */
export function resolveEmptyInteriorSpawns(config: PatrolConfiguration, locationId: string, phase: DayPhase,
  spaces: readonly PatrolSpace[], occupants: readonly { buildingId?: string; roomId?: string }[], random: () => number,
  heroContext: { buildingId?: string; roomId?: string } = {}) {
  const location = config.locations[locationId]
  const spawn = location?.emptyInteriorSpawn
  if (!location || location.enabled === false || phase !== 'night' || !spawn) return []
  return spaces.filter(space => {
    if (!space.roomId && spaces.some(other => other.buildingId === space.buildingId && (other.roomId || other.floor < space.floor))) return false
    if (occupants.some(npc => npc.buildingId === space.buildingId && (!space.roomId || npc.roomId === space.roomId))) return false
    if (heroContext.buildingId === space.buildingId && (!space.roomId || heroContext.roomId === space.roomId)) return false
    return random() < spawn.chance
  }).map(space => ({ definition: config.types[spawn.type], space }))
}
