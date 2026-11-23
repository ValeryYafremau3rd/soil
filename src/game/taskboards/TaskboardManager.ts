import type Phaser from 'phaser'
import type { QuestController } from '../../app/contracts/quests'
import { TASKBOARD_PLACEMENTS } from '../../content/taskboards'
import type { BuildingManager } from '../buildings/BuildingManager'
import { PlacedObjectManager } from '../interactive/PlacedObjectManager'
import { Taskboard } from './Taskboard'

/**
 * Owns taskboard manager state and behavior.
 */
export class TaskboardManager extends PlacedObjectManager<Taskboard> {
  /**
   * Initialize the TaskboardManager instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {string} locationId - The location id supplied to this operation.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {QuestController} quests - The quests supplied to this operation.
   * @param {BuildingManager} buildings - The buildings supplied to this operation.
   * @returns {TaskboardManager} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    locationId: string,
    groundY: number,
    quests: QuestController,
    buildings: BuildingManager
  ) {
    super(TASKBOARD_PLACEMENTS.filter(placement => placement.locationId === locationId).map(placement =>
      new Taskboard(
        scene,
        placement,
        placement.buildingId
          ? buildings.interiorFloorY(placement.buildingId, placement.floor ?? 0) : groundY,
        quests
      )))
  }

  /**
   * Perform platforms for TaskboardManager.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    return this.objects.flatMap(board => board.platforms)
  }
}
