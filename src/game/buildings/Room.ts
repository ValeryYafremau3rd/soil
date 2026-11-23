import type Phaser from 'phaser'
import type { RoomDefinition, RoomBinding, BuildingDefinition } from '../../content/types'
import { GAME_SETTINGS, WORLD_LAYERS, MINIMUM_INTERIOR_HEIGHT } from '../../content/world'
import { HERO_SETTINGS } from '../../content/hero'
import { createWorldHint } from '../rendering/createWorldHint'
import { worldSurfaces } from '../physics/surfaces'
import type { RoomDoor } from '../../domain/buildings/rooms'
import { createObjectLight } from '../rendering/createObjectLight'

/**
 * Owns room state and behavior.
 */
export class Room {
  readonly door: RoomDoor
  readonly definition: RoomDefinition
  private readonly image: Phaser.GameObjects.Image
  private readonly exitMarker: Phaser.GameObjects.Text
  private readonly scale: number

  /**
   * Initialize the Room instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {RoomBinding} binding - The binding supplied to this operation.
   * @param {RoomDefinition} definition - The definition supplied to this operation.
   * @param {BuildingDefinition} building - The building supplied to this operation.
   * @param {number} buildingLeft - The building left supplied to this operation.
   * @param {number} entranceY - The entrance y supplied to this operation.
   * @returns {Room} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    binding: RoomBinding,
    definition: RoomDefinition,
    building: BuildingDefinition,
    buildingLeft: number,
    entranceY: number
  ) {
    this.definition = definition
    this.scale = building.scale
    const floorY = entranceY + (building.inner.floors[binding.floor].y - building.inner.groundY) * this.scale
    this.door = {
      id: binding.id,
      floor: binding.floor,
      x: buildingLeft + binding.doorX * this.scale,
      y: floorY
    }
    this.image = scene.add.image(
      buildingLeft + binding.x * this.scale,
      floorY - definition.groundY * this.scale,
      definition.sprite.key
    ).setOrigin(0).setScale(
      this.scale * (definition.widthScale ?? 1),
      this.scale
    ).setDepth(WORLD_LAYERS.room).setVisible(false)
    const marker = GAME_SETTINGS.exitMarker
    this.exitMarker = createWorldHint(scene, this.door.x, floorY - marker.offsetY, marker.label)
      .setStyle({
        color: marker.color,
        backgroundColor: marker.backgroundColor,
        fontSize: marker.fontSize
      })
    createObjectLight(scene, 'room', () => ({
      x: (this.bounds.left + this.bounds.right) / 2,
      y: this.bounds.ceiling, visible: this.image.visible
    }))
  }

  /**
   * Set visible.
   * @param {boolean} visible - Whether the presentation should be visible.
   * @returns {void} Completes the operation without returning a value.
   */
  setVisible(visible: boolean): void {
    this.image.setVisible(visible)
    this.exitMarker.setVisible(visible)
  }

  /**
   * Perform bounds for Room.
   * @returns {{ left: number; right: number; ceiling: number; }} The result described by the TypeScript return signature.
   */
  get bounds() {
    const bounds = this.definition.bounds

    return {
      left: this.image.x + bounds.left * this.scale + HERO_SETTINGS.edgeMargin,
      right: this.image.x + bounds.right * this.scale - HERO_SETTINGS.edgeMargin,
      ceiling: Math.min(
        this.image.y + bounds.ceiling * this.scale,
        this.door.y - MINIMUM_INTERIOR_HEIGHT
      )
    }
  }

  /**
   * Perform platforms for Room.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    return worldSurfaces(`room:${this.door.id}`, this.image.getBounds(), this.definition.platforms)
  }

  /**
   * Perform space for Room.
   * @returns {{ id: string; definition: RoomDefinition; x: number; groundY: number; scale: number; }} The result described by the TypeScript return signature.
   */
  get space() {
    return {
      id: this.door.id,
      definition: this.definition,
      x: this.image.x,
      groundY: this.door.y,
      scale: this.scale
    }
  }
}
