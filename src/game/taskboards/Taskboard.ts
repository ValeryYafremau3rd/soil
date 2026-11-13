import type Phaser from 'phaser'
import type { QuestController } from '../../app/contracts/quests'
import type { TaskboardPlacement } from '../../content/types'
import { TASKBOARD_TYPES } from '../../content/taskboards'
import { WORLD_LAYERS } from '../../content/world'
import { InteractiveObject } from '../interactive/InteractiveObject'
import { prepareSprites, preloadSprites } from '../rendering/prepareSprites'
import { worldSurfaces } from '../physics/surfaces'
import { createObjectLight } from '../rendering/createObjectLight'

export class Taskboard extends InteractiveObject {
  readonly placement: TaskboardPlacement
  private readonly quests: QuestController

  static preload(scene: Phaser.Scene): void { preloadSprites(scene, Object.values(TASKBOARD_TYPES)) }

  constructor(scene: Phaser.Scene, placement: TaskboardPlacement, floorY: number, quests: QuestController) {
    const definition = TASKBOARD_TYPES[placement.type]
    prepareSprites(scene, [definition])
    const sprite = scene.add.image(placement.x, floorY - placement.heightOffset, definition.key).setOrigin(0.5, 1)
    sprite.setScale(definition.displayHeight * definition.scale * (placement.scale ?? 1) / sprite.height)
      .setDepth(WORLD_LAYERS.actors)
    super(scene, sprite, definition.interactionRadius, definition.prompt, 'actor', placement.heightOffset)
    this.placement = placement
    this.quests = quests
    createObjectLight(scene, 'taskboard', () => ({ x: sprite.x, y: sprite.getBounds().top, visible: sprite.visible }))
  }

  protected interact(): void { this.quests.openBoard() }

  get platforms() {
    const platform = TASKBOARD_TYPES[this.placement.type].platform
    return this.sprite.visible && platform ? worldSurfaces(this.placement.id, this.sprite.getBounds(), [platform]) : []
  }
}
