import { reference,requireCondition,surfaces,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validateBuildings(context: ContentContext) {
  const { buildings, rooms, hero } = context
for (const [id, building] of Object.entries(buildings)) {
    const sprites = Object.fromEntries(building.sprites.map(sprite => [sprite.key, sprite]))
    for (const view of [building.outer, building.inner]) {
      surfaces(view.platforms, `buildings.json.${id}.platforms`)
      reference(sprites, view.key, `buildings.json.${id}.view.key`)
      const sprite = sprites[view.key]
      if (sprite.crop) requireCondition(view.crop.x + view.crop.width <= sprite.crop.width
        && view.crop.y + view.crop.height <= sprite.crop.height, `buildings.json.${id}: view crop exceeds its sprite`)
      requireCondition(view.floors[0].y === view.groundY, `buildings.json.${id}: first floor must match groundY`)
      view.floors.forEach((floor, index, floors) => {
        requireCondition(floor.left < floor.right && floor.ceiling < floor.y, `buildings.json.${id}.floors[${index}]: invalid boundaries`)
        if (index > 0 && (view !== building.inner || !building.stairs)) requireCondition(floor.y < floors[index - 1].y, `buildings.json.${id}.floors: list from ground to top`)
      })
    }
    if (building.stairs) {
      const reached = new Set([0])
      for (const [index, stair] of building.stairs.entries()) {
        const path = `buildings.json.${id}.stairs[${index}]`
        const from = building.inner.floors[stair.fromFloor], to = building.inner.floors[stair.toFloor]
        requireCondition(from && to && from.y > to.y, `${path}: stairs must connect a lower floor to a higher floor`)
        requireCondition(stair.fromX >= from.left && stair.fromX <= from.right && stair.toX >= to.left && stair.toX <= to.right,
          `${path}: stair endpoints are outside floor boundaries`)
        requireCondition(stair.landingX >= Math.min(from.left, to.left) && stair.landingX <= Math.max(from.right, to.right),
          `${path}.landingX: outside stair boundaries`)
      }
      for (let pass = 0; pass < building.inner.floors.length; pass++) {
        for (const stair of building.stairs) if (reached.has(stair.fromFloor)) reached.add(stair.toFloor)
      }
      requireCondition(reached.size === building.inner.floors.length, `buildings.json.${id}.stairs: every floor must be reachable from the ground floor`)
    } else for (const floor of building.inner.floors) requireCondition(building.stairX >= floor.left && building.stairX <= floor.right,
      `buildings.json.${id}.stairX: outside a floor's boundaries`)
    if (building.entrances) {
      requireCondition(new Set(building.entrances).size === building.entrances.length && building.entrances.includes(building.entranceX),
        `buildings.json.${id}.entrances: unique doors must include the primary entrance`)
      for (const x of building.entrances) for (const view of [building.outer, building.inner]) {
        requireCondition(x >= view.floors[0].left && x <= view.floors[0].right,
          `buildings.json.${id}.entrances: door is outside ground floor boundaries`)
      }
    }
    unique((building.rooms ?? []).map(room => room.id), `buildings.json.${id}.rooms`)
    for (const binding of building.rooms ?? []) {
      const path = `buildings.json.${id}.rooms.${binding.id}`
      reference(rooms, binding.type, `${path}.type`)
      const floor = building.inner.floors[binding.floor], room = rooms[binding.type]
      requireCondition(floor, `${path}.floor: floor does not exist`)
      requireCondition(binding.x + room.bounds.left >= floor.left && binding.x + room.bounds.right <= floor.right,
        `${path}.x: room lies outside the building floor`)
      requireCondition(room.groundY - room.bounds.ceiling <= floor.y - floor.ceiling,
        `${path}: room exceeds floor height`)
      requireCondition(binding.doorX >= binding.x + room.bounds.left + hero.settings.edgeMargin / building.scale
        && binding.doorX <= binding.x + room.bounds.right - hero.settings.edgeMargin / building.scale,
      `${path}.doorX: door is outside the walkable room`)
    }
  }
}
