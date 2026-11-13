import type Phaser from 'phaser'
import type { InventoryController } from '../../app/contracts/inventory'
import type { PatrolDefinition } from '../../content/types'
import { rollCorpseLoot } from '../../domain/combat/patrolCombat'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { InteractiveObject } from '../interactive/InteractiveObject'
import { updateInteractiveObjects } from '../interactive/updateInteractiveObjects'
import { WORLD_LAYERS } from '../../content/world'

interface CorpseContext { buildingId?: string; floor?: number }

class CorpseLoot extends InteractiveObject {
  readonly id: string
  private readonly inventory: InventoryController

  constructor(scene: Phaser.Scene, source: Phaser.GameObjects.Sprite, definition: PatrolDefinition,
    id: string, inventory: InventoryController) {
    const sprite = scene.add.image(source.x, source.y, source.texture.key,
      `${definition.death.key}:${definition.death.steps.length - 1}`)
      .setOrigin(source.originX, source.originY).setScale(source.scaleX, source.scaleY)
      .setFlip(source.flipX, source.flipY).setDepth(WORLD_LAYERS.actors)
    super(scene, sprite, definition.interactionRadius, `Enter · Search ${definition.name} corpse`, 'object')
    this.id = id
    this.inventory = inventory
  }

  protected interact(): void { this.inventory.openContainer(this.id) }
}

/** Corpses last until the next time shift or the end of the location visit. */
export class CorpseManager {
  private readonly scene: Phaser.Scene
  private readonly locationId: string
  private readonly inventory: InventoryController
  private readonly objects: { object: CorpseLoot; context: CorpseContext }[] = []
  private context: CorpseContext & { roomId?: string } = {}
  private nextId = 0

  constructor(scene: Phaser.Scene, locationId: string, inventory: InventoryController) {
    this.scene = scene
    this.locationId = locationId
    this.inventory = inventory
    scene.events.once('shutdown', () => this.destroy())
  }

  add = (source: Phaser.GameObjects.Sprite, definition: PatrolDefinition, context: CorpseContext): void => {
    const id = `corpse:${this.locationId}:${++this.nextId}`
    this.inventory.addTemporaryContainer({ id, name: `${definition.name} corpse`, locationId: this.locationId,
      items: rollCorpseLoot(definition.corpseLoot ?? []) })
    this.objects.push({ object: new CorpseLoot(this.scene, source, definition, id, this.inventory), context })
    this.setContext(this.context.buildingId, this.context.floor, this.context.roomId)
  }

  setContext(buildingId?: string, floor?: number, roomId?: string): void {
    this.context = { buildingId, floor, roomId }
    for (const { object, context } of this.objects) {
      object.setVisible(!roomId && context.buildingId === buildingId && (!buildingId || context.floor === floor))
    }
  }

  update(hero: Hero, actions: InputActions): boolean {
    return updateInteractiveObjects(this.objects.map(entry => entry.object), hero, actions)
  }

  destroy(): void {
    for (const { object } of this.objects) {
      this.inventory.removeTemporaryContainer(object.id)
      object.destroy()
    }
    this.objects.length = 0
  }
}
