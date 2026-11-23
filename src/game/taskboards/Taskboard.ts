import type Phaser from 'phaser'
import type { QuestController } from '../../app/contracts/quests'
import type { TaskboardPlacement } from '../../content/types'
import { TASKBOARD_TYPES } from '../../content/taskboards'
import { WORLD_LAYERS } from '../../content/world'
import { InteractiveObject } from '../interactive/InteractiveObject'
import { prepareSprites, preloadSprites } from '../rendering/prepareSprites'
import { worldSurfaces } from '../physics/surfaces'
import { createObjectLight } from '../rendering/createObjectLight'

/**
 * Owns taskboard state and behavior.
 */
export class Taskboard extends InteractiveObject {
  readonly placement: TaskboardPlacement
  private readonly quests: QuestController

  /**
   * Perform preload for Taskboard.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {void} Completes the operation without returning a value.
   */
  static preload(scene: Phaser.Scene): void {
    preloadSprites(scene, Object.values(TASKBOARD_TYPES))
  }

  /**
   * Initialize the Taskboard instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {TaskboardPlacement} placement - The placement supplied to this operation.
   * @param {number} floorY - The floor y supplied to this operation.
   * @param {QuestController} quests - The quests supplied to this operation.
   * @returns {Taskboard} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    placement: TaskboardPlacement,
    floorY: number,
    quests: QuestController
  ) {
    const definition = TASKBOARD_TYPES[placement.type]
    prepareSprites(scene, [definition])
    const sprite = scene.add.image(placement.x, floorY - placement.heightOffset, definition.key).setOrigin(
      0.5,
      1
    )
    sprite.setScale(definition.displayHeight * definition.scale * (placement.scale ?? 1) / sprite.height)
      .setDepth(WORLD_LAYERS.actors)
    super(
      scene,
      sprite,
      definition.interactionRadius,
      definition.prompt,
      'actor',
      placement.heightOffset
    )
    this.placement = placement
    this.quests = quests
    createObjectLight(
      scene,
      'taskboard',
      () => ({ x: sprite.x, y: sprite.getBounds().top, visible: sprite.visible })
    )
  }

  /**
   * Perform interact for Taskboard.
   * @returns {void} Completes the operation without returning a value.
   */
  protected interact(): void {
    this.quests.openBoard()
  }

  /**
   * Perform platforms for Taskboard.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    const platform = TASKBOARD_TYPES[this.placement.type].platform

    return this.sprite.visible && platform ? worldSurfaces(this.placement.id, this.sprite.getBounds(), [platform]) : []
  }
}
