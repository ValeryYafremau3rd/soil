import type Phaser from 'phaser'
import type { QuestController } from '../../app/contracts/quests'
import { TASKBOARD_PLACEMENTS } from '../../content/taskboards'
import type { BuildingManager } from '../buildings/BuildingManager'
import { PlacedObjectManager } from '../interactive/PlacedObjectManager'
import { Taskboard } from './Taskboard'

export class TaskboardManager extends PlacedObjectManager<Taskboard> {
  constructor(scene: Phaser.Scene, locationId: string, groundY: number, quests: QuestController, buildings: BuildingManager) {
    super(TASKBOARD_PLACEMENTS.filter(placement => placement.locationId === locationId).map(placement =>
      new Taskboard(scene, placement, placement.buildingId
        ? buildings.interiorFloorY(placement.buildingId, placement.floor ?? 0) : groundY, quests)))
  }

  get platforms() { return this.objects.flatMap(board => board.platforms) }
}
