import type Phaser from 'phaser'
import type { InventoryController } from '../../app/contracts/inventory'
import { CONTAINER_SHEET, CONTAINER_TYPES } from '../../content/containers'
import type { ContainerPlacement } from '../../content/containers'
import { createCutoutTexture } from '../rendering/createCutoutTexture'
import { Container } from './Container'
import { WORLD_LAYERS } from '../../content/world'
import { worldSurfaces } from '../physics/surfaces'

export class LootContainer extends Container {
  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(CONTAINER_SHEET.sourceKey)) {
      scene.load.image(CONTAINER_SHEET.sourceKey, `${import.meta.env.BASE_URL}${CONTAINER_SHEET.path}`)
    }
  }

  constructor(scene: Phaser.Scene, placement: ContainerPlacement, groundY: number, inventory: InventoryController) {
    createCutoutTexture(scene, CONTAINER_SHEET.sourceKey, CONTAINER_SHEET.textureKey, CONTAINER_SHEET.background ?? 'dark')
    const texture = scene.textures.get(CONTAINER_SHEET.textureKey)
    const ratio = texture.getSourceImage().width / CONTAINER_SHEET.referenceWidth
    for (const [name, frame] of Object.entries(CONTAINER_TYPES)) {
      if (!texture.has(name)) texture.add(name, 0, Math.round(frame.x * ratio), Math.round(frame.y * ratio),
        Math.round(frame.width * ratio), Math.round(frame.height * ratio))
    }
    super(scene, placement, groundY, inventory)
    this.sprite.setFrame(placement.type).setDepth(WORLD_LAYERS.actors + 0.01)
    const definition = CONTAINER_TYPES[placement.type]
    this.sprite.setOrigin(0.5, definition.groundOrigin ?? 1)
    this.sprite.setScale(definition.displayHeight * (definition.scale ?? 1) * (placement.scale ?? 1) / this.sprite.height)
  }

  get platforms() {
    const platform = CONTAINER_TYPES[this.placement.type].platform
    return this.sprite.visible && platform ? worldSurfaces(this.placement.id, this.sprite.getBounds(), [platform]) : []
  }
}
