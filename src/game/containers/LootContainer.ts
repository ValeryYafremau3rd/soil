import type Phaser from 'phaser'
import type { InventoryController } from '../../app/contracts/inventory'
import { CONTAINER_SHEET, CONTAINER_TYPES } from '../../content/containers'
import type { ContainerPlacement } from '../../content/containers'
import { createCutoutTexture } from '../rendering/createCutoutTexture'
import { Container } from './Container'
import { WORLD_LAYERS } from '../../content/world'
import { worldSurfaces } from '../physics/surfaces'

/**
 * Owns loot container state and behavior.
 */
export class LootContainer extends Container {
  /**
   * Perform preload for LootContainer.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {void} Completes the operation without returning a value.
   */
  static preload(scene: Phaser.Scene): void {
    const sheets = [
      CONTAINER_SHEET,
      ...Object.values(CONTAINER_TYPES).flatMap(type => type.sheet ? [type.sheet] : [])
    ]

    for (const sheet of sheets) {
      if (!scene.textures.exists(sheet.sourceKey)) {
        scene.load.image(sheet.sourceKey, `${import.meta.env.BASE_URL}${sheet.path}`)
      }
    }
  }

  /**
   * Initialize the LootContainer instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {ContainerPlacement} placement - The placement supplied to this operation.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {InventoryController} inventory - Inventory capability used to read or transact items.
   * @returns {LootContainer} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    placement: ContainerPlacement,
    groundY: number,
    inventory: InventoryController
  ) {
    for (const [name, frame] of Object.entries(CONTAINER_TYPES)) {
      const sheet = frame.sheet ?? CONTAINER_SHEET
      createCutoutTexture(scene, sheet.sourceKey, sheet.textureKey, sheet.background ?? 'dark')
      const texture = scene.textures.get(sheet.textureKey)
      const ratio = texture.getSourceImage().width / sheet.referenceWidth
      if (!texture.has(name)) texture.add(name, 0, Math.round(frame.x * ratio), Math.round(frame.y * ratio),
        Math.round(frame.width * ratio), Math.round(frame.height * ratio))
    }

    super(scene, placement, groundY, inventory)
    const definition = CONTAINER_TYPES[placement.type]
    this.sprite.setTexture((definition.sheet ?? CONTAINER_SHEET).textureKey, placement.type)
      .setDepth(WORLD_LAYERS.actors + 0.01)
    this.sprite.setOrigin(0.5, definition.groundOrigin ?? 1)
    this.sprite.setScale(definition.displayHeight * (definition.scale ?? 1) * (placement.scale ?? 1) / this.sprite.height)
  }

  /**
   * Perform platforms for LootContainer.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    const platform = CONTAINER_TYPES[this.placement.type].platform

    return this.sprite.visible && platform ? worldSurfaces(this.placement.id, this.sprite.getBounds(), [platform]) : []
  }
}
