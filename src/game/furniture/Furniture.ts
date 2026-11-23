import type Phaser from 'phaser'
import type { FurnitureDefinition, ObjectPlacement } from '../../content/types'
import { WORLD_LAYERS } from '../../content/world'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { InteractiveObject } from '../interactive/InteractiveObject'
import { worldSurfaces } from '../physics/surfaces'

/**
 * World furniture instance with action and interior placement overrides.
 */
export interface FurniturePlacement extends ObjectPlacement {
  roomId?: string
}

/**
 * Owns furniture state and behavior.
 */
export class Furniture extends InteractiveObject {
  readonly placement: FurniturePlacement
  readonly definition: FurnitureDefinition
  private hero?: Hero
  private readonly activate: (object: Furniture, hero: Hero) => void

  /**
   * Initialize the Furniture instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {FurniturePlacement} placement - The placement supplied to this operation.
   * @param {FurnitureDefinition} definition - The definition supplied to this operation.
   * @param {number} floorY - The floor y supplied to this operation.
   * @param {(object: Furniture, hero: Hero) => void} activate - The activate supplied to this operation.
   * @returns {Furniture} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    placement: FurniturePlacement,
    definition: FurnitureDefinition,
    floorY: number,
    activate: (object: Furniture, hero: Hero) => void
  ) {
    const sprite = scene.add.image(placement.x, floorY, definition.key).setOrigin(
      0.5,
      definition.groundOrigin ?? 1
    ).setDepth(definition.depth ?? WORLD_LAYERS.actors)
    sprite.setScale(definition.displayHeight * definition.scale * (placement.scale ?? 1) / sprite.height)
    super(scene, sprite, definition.interactionRadius, definition.prompt)
    this.definition = definition
    this.placement = placement
    this.activate = activate
  }

  /**
   * Check whether interact with is allowed.
   * @param {Hero} hero - The hero supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  override canInteractWith(hero: Hero): boolean {
    if (this.definition.action === 'none') return false

    if (hero.hiddenObjectId) return this.sprite.visible && hero.hiddenObjectId === this.placement.id

    return super.canInteractWith(hero)
  }

  /**
   * Perform update for Furniture.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {InputActions} actions - The actions supplied to this operation.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  override update(
    hero: Hero,
    actions: InputActions,
    enabled = true
  ): boolean {
    this.hero = hero
    this.setPrompt(hero.hiddenObjectId === this.placement.id ? this.definition.revealPrompt!
      : this.definition.prompt)

    return super.update(hero, actions, enabled)
  }

  /**
   * Perform interact for Furniture.
   * @returns {void} Completes the operation without returning a value.
   */
  protected interact(): void {
    this.activate(this, this.hero!)
  }

  /**
   * Perform platforms for Furniture.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    return this.sprite.visible ? worldSurfaces(
      this.placement.id,
      this.sprite.getBounds(),
      this.definition.platforms ?? (this.definition.platform ? [this.definition.platform] : [])
    ) : []
  }
}
