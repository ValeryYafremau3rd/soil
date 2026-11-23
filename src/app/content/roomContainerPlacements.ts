import type { TravelLocation } from '../contracts/travel'
import type { BuildingDefinition, ContainerPlacement, RoomDefinition } from '../../content/types'

/**
 * Give each room instance its own persistent loot ID and convert local coordinates once.
 * @param {readonly TravelLocation[]} locations - The locations supplied to this operation.
 * @param {Readonly<Record<string, BuildingDefinition>>} buildings - The buildings supplied to this operation.
 * @param {Readonly<Record<string, RoomDefinition>>} rooms - The rooms supplied to this operation.
 * @returns {ContainerPlacement[]} The result described by the TypeScript return signature.
 */
export function roomContainerPlacements(
  locations: readonly TravelLocation[],
  buildings: Readonly<Record<string, BuildingDefinition>>,
  rooms: Readonly<Record<string, RoomDefinition>>
): ContainerPlacement[] {
  return locations.flatMap(location => location.buildings.filter(instance => instance.enabled !== false).flatMap(instance => {
    const building = buildings[instance.type]
    if (!building) return []
    // Shape/reference validation reports malformed authored data.
    const scale = building.scale * (instance.scale ?? 1)
    const left = instance.entranceX - building.entranceX * scale

    return (building.rooms ?? []).flatMap(binding => {
      const room = rooms[binding.type]

      return Array.isArray(room?.containers) ? room.containers.filter(piece => piece.enabled !== false).map(piece => ({
        ...piece,
        id: `${location.id}:${instance.id}:${binding.id}:${piece.id}`,
        locationId: location.id,
        buildingId: instance.id,
        roomId: binding.id,
        floor: binding.floor,
        space: 'inside' as const,
        x: left + (binding.x + piece.x) * scale,
        scale: scale * (piece.scale ?? 1),
        heightOffset: (piece.heightOffset ?? 0) * scale,
      })) : []
    })
  }))
}
