import type { ObjectPlacement } from '../../../content/types'
import { requireCondition } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validatePlacement(context: ContentContext) {
  const { buildings, locations, hero } = context
return function validatePlacement(placement: ObjectPlacement, path: string) {
    const location = locations.find(candidate => candidate.id === placement.locationId)
    requireCondition(location, `${path}.locationId: unknown location "${placement.locationId}"`)
    if (placement.space === 'outside') {
      requireCondition(!placement.buildingId && placement.floor === undefined, `${path}: outdoor containers/props cannot bind to an indoor floor`)
      return undefined
    }
    const placedBuilding = location.buildings.find(building => building.id === placement.buildingId)
    requireCondition(placedBuilding, `${path}.buildingId: unknown building instance "${placement.buildingId}"`)
    const definition = buildings[placedBuilding.type]
    const floor = definition.inner.floors[placement.floor ?? 0]
    requireCondition(floor, `${path}.floor: floor does not exist`)
    const scale = definition.scale * (placedBuilding.scale ?? 1)
    const left = placedBuilding.entranceX - definition.entranceX * scale
    requireCondition(placement.x >= left + floor.left * scale + hero.settings.edgeMargin
      && placement.x <= left + floor.right * scale - hero.settings.edgeMargin, `${path}.x: outside the walkable floor`)
    return { floor, scale }
  }
}
