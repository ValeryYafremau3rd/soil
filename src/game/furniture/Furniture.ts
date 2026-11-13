import type Phaser from 'phaser'
import type { FurnitureDefinition, ObjectPlacement } from '../../content/types'
import { WORLD_LAYERS } from '../../content/world'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { InteractiveObject } from '../interactive/InteractiveObject'
import { worldSurfaces } from '../physics/surfaces'

export interface FurniturePlacement extends ObjectPlacement { roomId?: string }

export class Furniture extends InteractiveObject {
  readonly placement: FurniturePlacement
  readonly definition: FurnitureDefinition
  private hero?: Hero
  private readonly activate: (object: Furniture, hero: Hero) => void

  constructor(scene: Phaser.Scene, placement: FurniturePlacement, definition: FurnitureDefinition, floorY: number,
    activate: (object: Furniture, hero: Hero) => void) {
    const sprite = scene.add.image(placement.x, floorY, definition.key).setOrigin(0.5, definition.groundOrigin ?? 1).setDepth(definition.depth ?? WORLD_LAYERS.actors)
    sprite.setScale(definition.displayHeight * definition.scale * (placement.scale ?? 1) / sprite.height)
    super(scene, sprite, definition.interactionRadius, definition.prompt)
    this.definition = definition
    this.placement = placement
    this.activate = activate
  }

  override canInteractWith(hero: Hero): boolean {
    if (this.definition.action === 'none') return false
    if (hero.hiddenObjectId) return this.sprite.visible && hero.hiddenObjectId === this.placement.id
    return super.canInteractWith(hero)
  }

  override update(hero: Hero, actions: InputActions, enabled = true): boolean {
    this.hero = hero
    this.setPrompt(hero.hiddenObjectId === this.placement.id ? this.definition.revealPrompt!
      : this.definition.prompt)
    return super.update(hero, actions, enabled)
  }

  protected interact(): void { this.activate(this, this.hero!) }

  get platforms() {
    return this.sprite.visible ? worldSurfaces(this.placement.id, this.sprite.getBounds(),
      this.definition.platforms ?? (this.definition.platform ? [this.definition.platform] : [])) : []
  }
}
