import type Phaser from 'phaser'
import type { StoryController } from '../../app/contracts/story'
import type { TravelLocation } from '../../app/contracts/travel'
import { BUILDINGS } from '../../content/buildings'
import { CONTENT } from '../../content/catalogue'
import { GAME_SETTINGS } from '../../content/world'
import type { StoryConfig, StoryInteraction } from '../../domain/quests/story'
import type { BuildingManager } from '../buildings/BuildingManager'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { createWorldHint, isSelectedHint } from '../rendering/createWorldHint'
import { StoryInteractionGlow } from '../rendering/StoryInteractionGlow'

/** A scene-owned readable label and shared prompt anchored to existing scenery. */
interface StoryMarker {
  object: StoryInteraction
  hint: Phaser.GameObjects.Text
  glow: StoryInteractionGlow
  x: number
  y: number
}

/** Owns clue/exit prompts; narrative rules and state remain in the story service. */
export class StoryWorld {
  private readonly markers: readonly StoryMarker[]
  private readonly story: StoryController
  private readonly buildings: BuildingManager
  private readonly config = CONTENT.data.story as StoryConfig

  /**
   * Place prompts on existing building floors or the outdoor ground.
   * @param {Phaser.Scene} scene - Scene that releases prompts on shutdown.
   * @param {TravelLocation} location - Current district and building placements.
   * @param {number} groundY - Outdoor ground coordinate in world pixels.
   * @param {BuildingManager} buildings - Floor geometry and current indoor context.
   * @param {StoryController} story - Typed narrative interaction actions.
   */
  constructor(
    scene: Phaser.Scene, location: TravelLocation, groundY: number,
    buildings: BuildingManager, story: StoryController,
  ) {
    this.story = story
    this.buildings = buildings
    this.markers = this.config.interactions.filter(object => object.locationId === location.id)
      .map(object => this.createMarker(scene, location, groundY, object))
  }

  /**
   * Resolve building-local coordinates and create a prompt using existing hint styling.
   * @param {Phaser.Scene} scene - Owning scene.
   * @param {TravelLocation} location - Building-instance transforms.
   * @param {number} groundY - Outdoor floor height in pixels.
   * @param {StoryInteraction} object - Authored interaction and placement.
   * @returns {StoryMarker} Scene-owned prompt at its resolved position.
   */
  private createMarker(
    scene: Phaser.Scene, location: TravelLocation, groundY: number, object: StoryInteraction,
  ): StoryMarker {
    const instance = location.buildings.find(building => building.id === object.buildingId)
    const type = instance && BUILDINGS[instance.type]
    const scale = type ? type.scale * (instance?.scale ?? 1) : 1
    const x = instance && type
      ? instance.entranceX + (object.x - type.entranceX) * scale : object.x
    const y = instance ? this.buildings.interiorFloorY(instance.id, object.floor ?? 0) : groundY
    const hint = createWorldHint(scene, x, y,
      this.config.messages.interact.replace('{name}', object.name))
    const glow = new StoryInteractionGlow(scene, hint, x, y)
    return { object, hint, glow, x, y }
  }

  /**
   * Participate in shared Enter selection without handling raw input.
   * @param {Hero} hero - Live actor position and interaction availability.
   * @param {InputActions} actions - Mapped player actions for this frame.
   * @returns {boolean} Whether one selected world object accepted Enter.
   */
  update(hero: Hero, actions: InputActions): boolean {
    let opened = false
    for (const marker of this.markers) {
      const visible = this.visible(marker.object)
      const nearby = visible && hero.canInteract
        && Math.abs(hero.sprite.x - marker.x) <= this.config.interactionRadius
        && Math.abs(hero.sprite.y - marker.y) <= GAME_SETTINGS.interaction.verticalTolerance
      marker.hint.setVisible(nearby).setPosition(hero.sprite.x,
        hero.sprite.y - hero.sprite.displayHeight - GAME_SETTINGS.interaction.hintGap)
      marker.glow.update(visible, nearby && isSelectedHint(marker.hint))
      if (!opened && nearby && actions.interactPressed && isSelectedHint(marker.hint)) {
        opened = this.story.interact(marker.object.id)
      }
    }
    return opened
  }

  /**
   * Match indoor context and show notices only after the affected NPC disappears.
   * @param {StoryInteraction} object - Placement and optional absence condition.
   * @returns {boolean} Whether the prompt belongs to the currently visible space.
   */
  private visible(object: StoryInteraction): boolean {
    return object.buildingId === this.buildings.activeId
      && object.roomId === this.buildings.activeRoomId
      && (object.floor === undefined || object.floor === this.buildings.activeFloor)
      && (!object.absentNpcId || this.story.isNpcAbsent(object.absentNpcId))
  }
}
