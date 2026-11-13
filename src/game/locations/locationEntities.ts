import type Phaser from 'phaser'
import type { DialogueController } from '../../app/contracts/dialogue'
import type { TravelLocation } from '../../app/contracts/travel'
import { BUILDINGS, buildingSprites } from '../../content/buildings'
import { NPCS } from '../../content/npcs'
import { ConfiguredBuilding } from '../buildings/ConfiguredBuilding'
import { DialogueNpc } from '../entities/DialogueNpc'
import { Npc } from '../entities/Npc'
import { preloadSprites } from '../rendering/prepareSprites'
import { LOCATIONS } from '../../content/locations'
import type { DayPhase } from '../../app/contracts/daytime'
import { resolveNpcPlacements } from '../../app/content/resolveNpcPlacements'
import { ROOMS } from '../../content/rooms'
import { HERO_SETTINGS } from '../../content/hero'
import { GAME_SETTINGS, MINIMUM_INTERIOR_HEIGHT } from '../../content/world'
import type { QuestController } from '../../app/contracts/quests'

export function preloadLocationEntities(scene: Phaser.Scene, location: TravelLocation): void {
  preloadSprites(scene, location.buildings.filter(placement => placement.enabled !== false)
    .flatMap(placement => buildingSprites(BUILDINGS[placement.type])))
  for (const definition of Object.values(NPCS)) Npc.preloadAssets(scene, definition)
}

export function createLocationNpcs(scene: Phaser.Scene, location: TravelLocation, groundY: number, dialogue: DialogueController, phase: DayPhase, quests?: Pick<QuestController, 'getOffer'>) {
  return resolveNpcPlacements(NPCS, LOCATIONS, location.id, phase).map(placement => {
    const definition = NPCS[placement.type]
    let x = placement.x, y = groundY, scale = (definition.scale ?? 1) * placement.scale
    if (placement.buildingId) {
      const instance = location.buildings.find(building => building.id === placement.buildingId)!
      const building = BUILDINGS[instance.type]
      const buildingScale = building.scale * (instance.scale ?? 1)
      const room = building.rooms?.find(room => room.id === placement.roomId)
      const floor = building.inner.floors[room?.floor ?? placement.floor ?? 0]
      const left = instance.entranceX - building.entranceX * buildingScale
      x = left + ((room?.x ?? 0) + placement.x) * buildingScale
      y = groundY + (floor.y - building.inner.groundY) * buildingScale
      const clearance = Math.max((room ? ROOMS[room.type].groundY - ROOMS[room.type].bounds.ceiling : floor.y - floor.ceiling) * buildingScale,
        MINIMUM_INTERIOR_HEIGHT)
      const roomScale = room ? HERO_SETTINGS.roomScale / HERO_SETTINGS.scale : 1
      scale = Math.min(0.9 * roomScale, (clearance - GAME_SETTINGS.interaction.interiorHeadroom) / definition.displayHeight)
    }
    const npc = new DialogueNpc(scene, { ...definition, scale }, x, y, dialogue, { ...placement, npcId: placement.type }, () => quests?.getOffer(placement.type) ?? null)
    npc.setContext()
    return npc
  })
}

export function createLocationEntities(scene: Phaser.Scene, location: TravelLocation, groundY: number, dialogue: DialogueController, phase: DayPhase, quests?: Pick<QuestController, 'getOffer'>) {
  return {
    buildings: location.buildings.filter(placement => placement.enabled !== false)
      .map(placement => new ConfiguredBuilding(scene, placement.id, {
        ...BUILDINGS[placement.type], scale: BUILDINGS[placement.type].scale * (placement.scale ?? 1),
      }, placement.entranceX, groundY)),
    npcs: createLocationNpcs(scene, location, groundY, dialogue, phase, quests),
  }
}
