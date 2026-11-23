import { reference, requireCondition, unique } from './assertions.ts'
import type { ContentContext } from './context.ts'

/**
 * Validate building-specific nighttime monster probabilities and type choices.
 * @param {ContentContext} context - Content used to resolve buildings and patrol types.
 * @param {string} locationId - District owning the interior spawn overrides.
 * @returns {void} Throws for duplicate buildings, missing placements or non-monster types.
 */
export function validateInteriorSpawnBuildings(
  context: ContentContext,
  locationId: string
): void {
  const entries = context.patrols.locations[locationId].emptyInteriorSpawn?.buildings ?? []
  const location = context.locations.find(location => location.id === locationId)
  const path = `patrols.json.locations.${locationId}.emptyInteriorSpawn.buildings`
  unique(entries.map(entry => entry.buildingId), path)
  for (const entry of entries) {
    requireCondition(location?.buildings.some(building =>
      building.id === entry.buildingId && building.enabled !== false), `${path}: unknown building`)
    unique(entry.types, `${path}.types`)
    for (const type of entry.types) {
      reference(context.patrols.types, type, `${path}.types`)
      requireCondition(context.patrols.types[type].kind === 'monster',
        `${path}.types: requires monster types`)
    }
  }
}
