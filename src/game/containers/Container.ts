import type Phaser from 'phaser'
import type { InventoryController } from '../../app/contracts/inventory'
import { CONTAINER_INTERACTION, CONTAINER_SHEET } from '../../content/containers'
import type { ContainerPlacement } from '../../content/containers'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { InteractiveObject } from '../interactive/InteractiveObject'

/**
 * Owns container state and behavior.
 */
export abstract class Container extends InteractiveObject {
  readonly placement: ContainerPlacement
  private readonly inventory: InventoryController

  /**
   * Initialize the Container instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {ContainerPlacement} placement - The placement supplied to this operation.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {InventoryController} inventory - Inventory capability used to read or transact items.
   * @returns {Container} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    placement: ContainerPlacement,
    groundY: number,
    inventory: InventoryController
  ) {
    super(
      scene,
      scene.add.image(placement.x, groundY, CONTAINER_SHEET.textureKey).setOrigin(0.5, 1),
      CONTAINER_INTERACTION.radius,
      CONTAINER_INTERACTION.prompt
    )
    this.placement = placement
    this.inventory = inventory
  }

  /**
   * Perform update for Container.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {InputActions} actions - The actions supplied to this operation.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  override update(hero: Hero, actions: InputActions, enabled = true): boolean {
    const contents = this.inventory.getSnapshot().containers[this.placement.id]
    this.setPrompt(contents.locked ? `Enter · Lockpick ${contents.name}`
      : `${CONTAINER_INTERACTION.prompt} ${contents.name}`)

    return super.update(hero, actions, enabled)
  }

  /**
   * Perform interact for Container.
   * @returns {void} Completes the operation without returning a value.
   */
  protected interact(): void {
    this.inventory.openContainer(this.placement.id)
  }
}
