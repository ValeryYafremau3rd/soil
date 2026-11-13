import type Phaser from 'phaser'
import type { InventoryController } from '../../app/contracts/inventory'
import { CONTAINER_PLACEMENTS } from '../../content/containers'
import { LootContainer } from './LootContainer'
import type { BuildingManager } from '../buildings/BuildingManager'
import { PlacedObjectManager } from '../interactive/PlacedObjectManager'

export class ContainerManager extends PlacedObjectManager<LootContainer> {
  constructor(scene: Phaser.Scene, locationId: string, groundY: number, inventory: InventoryController, buildings: BuildingManager) {
    super(CONTAINER_PLACEMENTS.filter(placement => placement.locationId === locationId)
      .map(placement => new LootContainer(scene, placement, (placement.buildingId
        ? buildings.interiorFloorY(placement.buildingId, placement.floor ?? 0) : groundY) - (placement.heightOffset ?? 0), inventory)))
  }

  override setInside(buildingId?: string, enabled = true, roomId?: string): void {
    for (const container of this.objects) {
      const placement = container.placement
      container.setVisible(enabled && (placement.roomId
        ? placement.buildingId === buildingId && placement.roomId === roomId
        : placement.space === 'inside' ? placement.buildingId === buildingId && !roomId : !buildingId))
    }
  }

  get platforms() { return this.objects.flatMap(container => container.platforms) }
}
