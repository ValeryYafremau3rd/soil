import type { NpcDefinition } from '../../../content/types'
import { reference, requireCondition } from './assertions.ts'
import type { ContentContext } from './context.ts'

/**
 * Validate npc against the supported rules.
 * @param {object} context - The context supplied to this operation.
 * @returns {(npc: NpcDefinition, path: string) => void} Callback that releases or performs the registered operation.
 */
export function validateNpc(context: ContentContext) {
  const { buildings, rooms, locations, dialogues, hero } = context

  return function validateNpc(
    npc: NpcDefinition,
    path: string
  ): void {
    if (npc.dialogueId) reference(dialogues, npc.dialogueId, `${path}.dialogueId`)

    for (const [action, steps] of [
      ['idleSteps', npc.idleSteps],
      ['walk.steps', npc.walk?.steps ?? []],
      ['run.steps', npc.run?.steps ?? []],
      ['attack.steps', npc.attack?.steps ?? []],
      ['shoot.steps', npc.shoot?.steps ?? []],
      ['death.steps', npc.death?.steps ?? []]
    ] as const) {
      for (const crop of steps) {
        for (const excluded of crop.excludeRegions ?? []) {
          requireCondition(
            npc.frameSize && excluded.x >= 0 && excluded.y >= 0
            && excluded.x + excluded.width <= crop.width && excluded.y + excluded.height <= crop.height,
            `${path}.${action}.excludeRegions: outside crop or missing frameSize`
          )
        }

        requireCondition(
          crop.x + crop.width <= npc.referenceWidth,
          `${path}.${action}: crop exceeds sheet width`
        )
        requireCondition((crop.anchorX ?? 0) <= crop.width && (crop.anchorY ?? 0) <= crop.height,
          `${path}.${action}: anchor exceeds its crop`)
        requireCondition(
          npc.frameSize || (crop.anchorX === undefined && crop.anchorY === undefined && crop.scale === undefined),
          `${path}.${action}: anchored frames require frameSize`
        )
      }
    }

    for (const [phase, position] of Object.entries(npc.schedule ?? {})) {
      const location = locations.find(location => location.id === position.locationId)
      const schedulePath = `${path}.schedule.${phase}`
      requireCondition(location,
        `${path}.schedule.${phase}.locationId: unknown location "${position.locationId}"`)
      if (!position.buildingId) {
        requireCondition(
          !position.roomId && position.floor === undefined,
          `${schedulePath}: room/floor requires a buildingId`
        )
        continue
      }

      const instance = location.buildings.find(building => building.id === position.buildingId)
      requireCondition(instance, `${schedulePath}.buildingId: unknown building instance`)
      reference(buildings, instance.type, `${schedulePath}.buildingId.type`)
      const building = buildings[instance.type]
      const room = position.roomId ? building.rooms?.find(room => room.id === position.roomId) : undefined
      requireCondition(!position.roomId || room, `${schedulePath}.roomId: unknown room`)
      requireCondition(
        !room || position.floor === undefined,
        `${schedulePath}: room determines its floor`
      )
      const floor = building.inner.floors[room?.floor ?? position.floor ?? 0]
      requireCondition(floor, `${schedulePath}.floor: floor does not exist`)
      const bounds = room ? rooms[room.type].bounds : floor
      const margin = hero.settings.edgeMargin / (building.scale * (instance.scale ?? 1))
      requireCondition(
        position.x >= bounds.left + margin && position.x <= bounds.right - margin,
        `${schedulePath}.x: outside the walkable interior`
      )
    }
  }
}
