import type Phaser from 'phaser'
import type { InventoryController } from '../../app/contracts/inventory'
import { CONTAINER_PLACEMENTS } from '../../content/containers'
import { LootContainer } from './LootContainer'
import type { BuildingManager } from '../buildings/BuildingManager'
import { PlacedObjectManager } from '../interactive/PlacedObjectManager'

/**
 * Owns container manager state and behavior.
 */
export class ContainerManager extends PlacedObjectManager<LootContainer> {
  /**
   * Initialize the ContainerManager instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {string} locationId - The location id supplied to this operation.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {InventoryController} inventory - Inventory capability used to read or transact items.
   * @param {BuildingManager} buildings - The buildings supplied to this operation.
   * @returns {ContainerManager} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    locationId: string,
    groundY: number,
    inventory: InventoryController,
    buildings: BuildingManager
  ) {
    super(CONTAINER_PLACEMENTS.filter(placement => placement.locationId === locationId)
      .map(placement => new LootContainer(
        scene,
        placement,
        (placement.buildingId
          ? buildings.interiorFloorY(placement.buildingId, placement.floor ?? 0) : groundY) - (placement.heightOffset ?? 0),
        inventory
      )))
  }

  /**
   * Set inside.
   * @param {string | undefined} buildingId - The building id supplied to this operation.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @param {string | undefined} roomId - The room id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  override setInside(
    buildingId?: string,
    enabled = true,
    roomId?: string
  ): void {
    for (const container of this.objects) {
      const placement = container.placement
      container.setVisible(enabled && (placement.roomId
        ? placement.buildingId === buildingId && placement.roomId === roomId
        : placement.space === 'inside' ? placement.buildingId === buildingId && !roomId : !buildingId))
    }
  }

  /**
   * Perform platforms for ContainerManager.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    return this.objects.flatMap(container => container.platforms)
  }
}
