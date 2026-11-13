import { reference,requireCondition,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validateLocations(context: ContentContext) {
  const { buildings, rooms, npcs, locations, items, hero } = context
for (const [index, location] of locations.entries()) {
    unique(location.buildings.map(building => building.id), `locations.json[${index}].buildings`)
    for (const direction of ['left', 'right'] as const) {
      const targetId = location.connections?.[direction]
      if (!targetId) continue
      const target = locations.find(candidate => candidate.id === targetId)
      const path = `locations.json[${index}].connections.${direction}`
      requireCondition(target && target !== location, `${path}: unknown location or self connection`)
      requireCondition(target.connections?.[direction === 'left' ? 'right' : 'left'] === location.id, `${path}: connection must link back from the opposite edge`)
    }
    for (const building of location.buildings) reference(buildings, building.type, `locations.json[${index}].buildings.${building.id}.type`)
    if (location.initialSpawn) {
      const spawn = location.initialSpawn, path = `locations.json[${index}].initialSpawn`
      const instance = location.buildings.find(building => building.id === spawn.buildingId)
      requireCondition(instance && instance.enabled !== false, `${path}.buildingId: unknown or disabled building`)
      const building = buildings[instance.type]
      const binding = building.rooms?.find(room => room.id === spawn.roomId)
      requireCondition(binding, `${path}.roomId: unknown room`)
      const room = rooms[binding.type]
      const margin = hero.settings.edgeMargin / (building.scale * (instance.scale ?? 1))
      requireCondition(spawn.x >= room.bounds.left + margin && spawn.x <= room.bounds.right - margin,
        `${path}.x: outside the walkable room`)
    }
    if (location.npc) reference(npcs, location.npc.type, `locations.json[${index}].npc.type`)
    requireCondition(Math.abs(location.busStop.spawnOffset) <= location.busStop.interactionRadius, `locations.json[${index}]: spawn must be near its bus stop`)
  }
const doorIds = new Set(locations.flatMap(location => location.buildings.flatMap(instance => [instance.id,
    ...(buildings[instance.type].rooms ?? []).map(room => `${instance.id}:${room.id}`)])))
for (const item of items) {
    unique((item.keys ?? []).map(key => key.id), `items.json.${item.id}.keys`)
    for (const key of item.keys ?? []) requireCondition(doorIds.has(key.doorId), `items.json.${item.id}.keys.${key.id}.doorId: unknown door ID "${key.doorId}"`)
  }
}
