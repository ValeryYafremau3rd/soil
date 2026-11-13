import type Phaser from 'phaser'
import type { RestController } from '../../app/contracts/rest'
import { FURNITURE } from '../../content/furniture'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import type { BuildingManager } from '../buildings/BuildingManager'
import { preloadSprites, prepareSprites } from '../rendering/prepareSprites'
import { updateInteractiveObjects } from '../interactive/updateInteractiveObjects'
import { Furniture } from './Furniture'

export class FurnitureManager {
  private readonly objects: readonly Furniture[]

  static preload(scene: Phaser.Scene): void { preloadSprites(scene, Object.values(FURNITURE.types)) }

  constructor(scene: Phaser.Scene, locationId: string, groundY: number, buildings: BuildingManager, rest: RestController) {
    prepareSprites(scene, Object.values(FURNITURE.types))
    const activate = (object: Furniture, hero: Hero): void => {
      if (object.definition.action === 'hide') {
        if (hero.hiddenObjectId) hero.reveal()
        else hero.hideBehind(object.placement.id, object.sprite.x, object.sprite.y, object.sprite.depth)
      } else if (object.definition.action !== 'none') rest.open(object.definition.action, object.definition.name)
    }
    this.objects = [
      ...FURNITURE.placements.filter(p => p.locationId === locationId && p.enabled !== false).map(p =>
        new Furniture(scene, p, FURNITURE.types[p.type], p.buildingId ? buildings.interiorFloorY(p.buildingId, p.floor ?? 0) : groundY, activate)),
      ...buildings.roomSpaces.flatMap(space => (space.definition.furniture ?? []).map(p => new Furniture(scene,
        { ...p, id: `${space.buildingId}:${space.id}:${p.id}`, locationId, space: 'inside', buildingId: space.buildingId,
          roomId: space.id, x: space.x + p.x * space.scale, scale: (p.scale ?? 1) * space.scale },
        FURNITURE.types[p.type], space.groundY, activate))),
    ]
    this.setContext()
  }

  setContext(buildingId?: string, roomId?: string): void {
    for (const object of this.objects) {
      const p = object.placement
      object.setVisible(p.roomId ? p.roomId === roomId && p.buildingId === buildingId
        : p.space === 'inside' ? p.buildingId === buildingId && !roomId : !buildingId)
    }
  }

  update(hero: Hero, actions: InputActions, enabled = true): boolean {
    return updateInteractiveObjects(this.objects, hero, actions, enabled)
  }

  get platforms() { return this.objects.flatMap(object => object.platforms) }
}
