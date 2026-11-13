import type Phaser from 'phaser'
import type { InventoryController } from '../../app/contracts/inventory'
import { CONTAINER_INTERACTION, CONTAINER_SHEET } from '../../content/containers'
import type { ContainerPlacement } from '../../content/containers'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { InteractiveObject } from '../interactive/InteractiveObject'

export abstract class Container extends InteractiveObject {
  readonly placement: ContainerPlacement
  private readonly inventory: InventoryController

  constructor(scene: Phaser.Scene, placement: ContainerPlacement, groundY: number, inventory: InventoryController) {
    super(scene, scene.add.image(placement.x, groundY, CONTAINER_SHEET.textureKey).setOrigin(0.5, 1),
      CONTAINER_INTERACTION.radius, CONTAINER_INTERACTION.prompt)
    this.placement = placement
    this.inventory = inventory
  }

  override update(hero: Hero, actions: InputActions, enabled = true): boolean {
    const contents = this.inventory.getSnapshot().containers[this.placement.id]
    this.setPrompt(contents.locked ? `Enter · Lockpick ${contents.name}`
      : `${CONTAINER_INTERACTION.prompt} ${contents.name}`)
    return super.update(hero, actions, enabled)
  }

  protected interact(): void {
    this.inventory.openContainer(this.placement.id)
  }
}
