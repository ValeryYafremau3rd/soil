import { reference, requireCondition, unique } from './assertions.ts'
import type { ContentContext } from './context.ts'
import { validateInteriorSpawnBuildings } from './validateInteriorSpawnBuildings.ts'

/**
 * Validate patrol populations against the supported rules.
 * @param {object} context - The context supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validatePatrolPopulations(context: ContentContext) {
  const { buildings, patrols, locations } = context

  for (const [locationId, config] of Object.entries(patrols.locations)) {
    const path = `patrols.json.locations.${locationId}`
    validateInteriorSpawnBuildings(context, locationId)
    requireCondition(
      locations.some(location => location.id === locationId),
      `${path}: unknown location "${locationId}"`
    )
    reference(patrols.types, config.type, `${path}.type`)

    for (const entry of config.outdoorSpawns ?? []) reference(patrols.types, entry.type, `${path}.outdoorSpawns.type`)

    requireCondition(
      config.bounds.left < config.bounds.right,
      `${path}.bounds: left must be less than right`
    )
    if (config.nightEncounters) {
      requireCondition(
        config.nightEncounters.length > 0,
        `${path}.nightEncounters: must contain at least one encounter`
      )

      for (const [index, encounter] of config.nightEncounters.entries()) {
        reference(patrols.types, encounter.type, `${path}.nightEncounters[${index}].type`)
      }
    }

    if (config.emptyInteriorSpawn) reference(
      patrols.types,
      config.emptyInteriorSpawn.type,
      `${path}.emptyInteriorSpawn.type`
    )

    for (const [index, room] of (config.emptyInteriorSpawn?.excludedRooms ?? []).entries()) {
      const roomPath = `${path}.emptyInteriorSpawn.excludedRooms[${index}]`
      const location = locations.find(location => location.id === locationId)!
      const building = location.buildings.find(building => building.id === room.buildingId)
      requireCondition(building, `${roomPath}.buildingId: unknown building`)
      requireCondition(
        buildings[building.type].rooms?.some(binding => binding.id === room.roomId),
        `${roomPath}.roomId: unknown room placement`
      )
    }

    unique((config.interiors ?? []).map(entry => entry.id), `${path}.interiors`)

    for (const [index, entry] of (config.interiors ?? []).entries()) {
      const entryPath = `${path}.interiors[${index}]`
      reference(patrols.types, entry.type, `${entryPath}.type`)
      const location = locations.find(location => location.id === locationId)!
      const building = location.buildings.find(building => building.id === entry.buildingId && building.enabled !== false)
      requireCondition(building, `${entryPath}.buildingId: unknown or disabled building`)
      requireCondition(
        buildings[building.type].inner.floors[entry.floor],
        `${entryPath}.floor: floor does not exist`
      )
      requireCondition(
        entry.bounds.left < entry.bounds.right,
        `${entryPath}.bounds: left must be less than right`
      )
    }
  }
}
