import type Phaser from 'phaser'
import type { RestController } from '../../app/contracts/rest'
import { FURNITURE } from '../../content/furniture'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import type { BuildingManager } from '../buildings/BuildingManager'
import { preloadSprites, prepareSprites } from '../rendering/prepareSprites'
import { updateInteractiveObjects } from '../interactive/updateInteractiveObjects'
import { Furniture } from './Furniture'

/**
 * Owns furniture manager state and behavior.
 */
export class FurnitureManager {
  private readonly objects: readonly Furniture[]

  /**
   * Perform preload for FurnitureManager.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {void} Completes the operation without returning a value.
   */
  static preload(scene: Phaser.Scene): void {
    preloadSprites(scene, Object.values(FURNITURE.types))
  }

  /**
   * Initialize the FurnitureManager instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {string} locationId - The location id supplied to this operation.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {BuildingManager} buildings - The buildings supplied to this operation.
   * @param {RestController} rest - The rest supplied to this operation.
   * @param {(id: string) => void} openVehicle - The open vehicle supplied to this operation.
   * @param {() => void} onHidden - Record a successful hide behind furniture.
   * @returns {FurnitureManager} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    locationId: string,
    groundY: number,
    buildings: BuildingManager,
    rest: RestController,
    openVehicle: (id: string) => void,
    onHidden: () => void
  ) {
    prepareSprites(scene, Object.values(FURNITURE.types))

    /**
     * Perform activate.
     * @param {Furniture} object - The object supplied to this operation.
     * @param {Hero} hero - The hero supplied to this operation.
     * @returns {void} Completes the operation without returning a value.
     */
    const activate = (
      object: Furniture,
      hero: Hero
    ): void => {
      if (object.definition.action === 'vehicle') openVehicle(object.placement.id)
      else if (object.definition.action === 'hide') {
        if (hero.hiddenObjectId) hero.reveal()
        else {
          hero.hideBehind(
            object.placement.id,
            object.sprite.x,
            object.sprite.y,
            object.sprite.depth
          )
          if (hero.hiddenObjectId === object.placement.id) onHidden()
        }
      } else if (object.definition.action !== 'none') rest.open(object.definition.action, object.definition.name)
    }
    this.objects = [
      ...FURNITURE.placements.filter(p => p.locationId === locationId && p.enabled !== false).map(p =>
        new Furniture(
          scene,
          p,
          FURNITURE.types[p.type],
          p.buildingId ? buildings.interiorFloorY(p.buildingId, p.floor ?? 0) : groundY,
          activate
        )),
      ...buildings.roomSpaces.flatMap(space => (space.definition.furniture ?? []).map(p => new Furniture(
        scene,
        {
          ...p,
          id: `${space.buildingId}:${space.id}:${p.id}`,
          locationId,
          space: 'inside',
          buildingId: space.buildingId,
          roomId: space.id,
          x: space.x + p.x * space.scale,
          scale: (p.scale ?? 1) * space.scale
        },
        FURNITURE.types[p.type],
        space.groundY,
        activate
      ))),
    ]
    this.setContext()
  }

  /**
   * Set context.
   * @param {string | undefined} buildingId - The building id supplied to this operation.
   * @param {string | undefined} roomId - The room id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  setContext(buildingId?: string, roomId?: string): void {
    for (const object of this.objects) {
      const p = object.placement
      object.setVisible(p.roomId ? p.roomId === roomId && p.buildingId === buildingId
        : p.space === 'inside' ? p.buildingId === buildingId && !roomId : !buildingId)
    }
  }

  /**
   * Perform update for FurnitureManager.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {InputActions} actions - The actions supplied to this operation.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  update(hero: Hero, actions: InputActions, enabled = true): boolean {
    return updateInteractiveObjects(this.objects, hero, actions, enabled)
  }

  /**
   * Perform platforms for FurnitureManager.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    return this.objects.flatMap(object => object.platforms)
  }
}
