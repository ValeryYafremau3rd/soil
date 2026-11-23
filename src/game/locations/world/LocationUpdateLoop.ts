import type { Platform } from '../../../domain/movement/platforms'
import type Phaser from 'phaser'
import type { DayPhase } from '../../../app/contracts/daytime'
import type { GameServices } from '../../../app/contracts/game'
import { isGameplayBlocked } from '../../../app/services/session/isGameplayBlocked'
import { ITEM_BY_ID } from '../../../content/items'
import { BuildingManager } from '../../buildings/BuildingManager'
import { ContainerManager } from '../../containers/ContainerManager'
import { CorpseManager } from '../../containers/CorpseManager'
import type { DialogueNpc } from '../../entities/DialogueNpc'
import { Hero } from '../../entities/Hero'
import { PatrolManager } from '../../entities/PatrolManager'
import { FurnitureManager } from '../../furniture/FurnitureManager'
import { KeyboardMouseInput } from '../../input/KeyboardMouseInput'
import { BoundaryTravel } from '../../interactive/BoundaryTravel'
import { BusStop } from '../../interactive/BusStop'
import { updateInteractiveObjects } from '../../interactive/updateInteractiveObjects'
import { WeatherOverlay } from '../../rendering/WeatherOverlay'
import { clearWorldHints, cycleWorldHint } from '../../rendering/createWorldHint'
import { TaskboardManager } from '../../taskboards/TaskboardManager'
import type { StoryWorld } from '../../interactive/StoryWorld'

/** Scene-owned objects and lifecycle callbacks consumed by the ordered frame loop. */
interface FrameAccess {
  storyWorld: StoryWorld
  services: GameServices
  hero: Hero
  controls: KeyboardMouseInput
  buildings: BuildingManager
  weather: WeatherOverlay
  scene: Phaser.Scene
  containers: ContainerManager
  taskboards: TaskboardManager
  furniture: FurnitureManager
  busStop: BusStop
  corpses: CorpseManager
  width: number
  boundaryTravel: BoundaryTravel
  getPatrols(): PatrolManager
  getNpcs(): readonly DialogueNpc[]
  getPhase(): DayPhase
  syncTime(): void
  syncContext(): void
  savePosition(): void
  transitionBuilding(name: string, entering: boolean, change: () => void): void
}

/** Coordinates gameplay frame ordering while managers retain their own state. */
export class LocationUpdateLoop {
  private readonly access: FrameAccess
  private lastAudioX?: number

  /**
   * Bind the loop after scene construction has finished.
   * @param {FrameAccess} access - Managers, current actor readers and world lifecycle callbacks.
   */
  constructor(access: FrameAccess) { this.access = access }

  /**
     * Perform update for LocationWorld.
     * @param {number} delta - Elapsed time since the previous update.
     * @returns {void} Completes the operation without returning a value.
     */
  update(delta: number): void {
    this.updatePresentation(delta)
    if (this.access.services.status.getSnapshot().health <= 0) {
      this.access.controls.setEnabled(false)
      this.access.getPatrols().pause()
      this.access.hero.die()

      return
    }

    const blocked = isGameplayBlocked(this.access.services) || this.access.services.status.getSnapshot().health <= 0
    this.access.controls.setEnabled(!blocked)
    if (!this.access.services.character || this.access.services.loading.getSnapshot().phase !== 'idle') {
      this.access.getPatrols().pause()
      this.access.hero.cancelAttackPreparation()
      this.access.hero.idle()

      return
    }

    this.updatePatrols(delta, blocked)
    const platforms = [
      ...this.access.containers.platforms,
      ...this.access.taskboards.platforms,
      ...this.access.furniture.platforms,
      ...this.access.buildings.platforms,
      ...(!this.access.buildings.isInside ? this.access.busStop.platforms : [])
    ]
    if (blocked) {
      this.updateBlocked(delta, platforms)

      return
    }

    this.updateActive(delta, platforms)
  }

  /**
   * Update audio, time-dependent populations, weather and camera feedback.
   * @param {number} delta - Elapsed gameplay milliseconds.
   * @returns {void} Preserves the existing world frame ordering.
   */
  private updatePresentation(delta: number): void {
    this.access.services.audio.setRunning(this.lastAudioX !== undefined && this.access.hero.sprite.x !== this.lastAudioX && this.access.hero.isRunning)
    this.lastAudioX = this.access.hero.sprite.x
    this.access.syncTime()
    this.access.services.audio.setWorld(this.access.buildings.isInside, this.access.getPatrols().pursuitKind)
    this.access.weather.update(
      delta,
      this.access.services.daytime.getSnapshot().weather ?? 'clear',
      this.access.buildings.isInside
    )
    if (isGameplayBlocked(this.access.services) || this.access.services.loading.getSnapshot().phase !== 'idle'
      || this.access.services.status.getSnapshot().health <= 0) this.access.scene.cameras.main.shakeEffect.reset()

  }


  /**
   * Advance detection and fear before processing player movement.
   * @param {number} delta - Elapsed gameplay milliseconds.
   * @returns {void} Preserves the existing world frame ordering.
   */
  private updatePatrols(delta: number, blocked: boolean): void {
    this.access.getPatrols().update(
      delta,
      {
        x: this.access.hero.sprite.x,
        y: this.access.hero.sprite.y,
        available: !this.access.hero.hiddenObjectId,
        hidden: Boolean(this.access.hero.hiddenObjectId),
        patrolPass: this.access.services.inventory.getSnapshot().items.some(stack => stack.quantity > 0 && ITEM_BY_ID[stack.itemId]?.patrolPass),
      },
      this.access.services.skillEffects.detection,
      !blocked,
      this.access.services.character?.skills
    )
    this.access.services.rest.setCombatActive(this.access.getPatrols().inCombat, this.access.getPatrols().underFearAura({
      x: this.access.hero.sprite.x, y: this.access.hero.sprite.y, available: !this.access.hero.hiddenObjectId,
    }))
  }


  /**
   * Preserve falling and stair integration while menus suppress gameplay input.
   * @param {number} delta - Elapsed gameplay milliseconds.
   * @param {readonly Platform[]} platforms - Current world support surfaces.
   * @returns {void} Updates neutral movement and eligible saved positions.
   */
  private updateBlocked(delta: number, platforms: readonly Platform[]): void {
    this.access.hero.cancelAttackPreparation()
    const neutral = {
      direction: 0, jumpPressed: false, fightPressed: false, shootPressed: false,
      fightHeld: false, shootHeld: false, interactPressed: false, stairsDirection: 0
    }
    const onStairs = this.access.buildings.update(
      this.access.hero,
      delta,
      neutral,
      this.access.services.lockpicking,
      this.access.transitionBuilding
    )
    this.access.syncContext()
    if (!onStairs) this.access.hero.update(delta, this.access.buildings.movementBounds(this.access.width), neutral, platforms)

    if (!onStairs && this.access.hero.canInteract) this.access.savePosition()

  }


  /**
   * Dispatch shared interaction selection, stairs and boundary travel in priority order.
   * @param {number} delta - Elapsed gameplay milliseconds.
   * @param {readonly Platform[]} platforms - Current world support surfaces.
   * @returns {void} Commits the first eligible interaction or integrates player movement.
   */
  private updateActive(delta: number, platforms: readonly Platform[]): void {
    const actions = this.access.controls.read()
    if (this.access.hero.hiddenObjectId) {
      clearWorldHints(this.access.scene)
      this.access.furniture.update(this.access.hero, actions)

      return
    }

    cycleWorldHint(this.access.scene, actions.optionDirection ?? 0)
    // Every nearby prompt participates in the shared Enter selection.
    if (this.access.storyWorld.update(this.access.hero, actions)
      || this.access.furniture.update(this.access.hero, actions)
      || this.access.containers.update(this.access.hero, actions)
      || this.access.corpses.update(this.access.hero, actions)
      || this.access.taskboards.update(this.access.hero, actions)
      || this.access.busStop.update(
        this.access.hero,
        actions,
        !this.access.buildings.isInside && this.access.getPhase() !== 'night'
      )
      || updateInteractiveObjects(this.access.getNpcs(), this.access.hero, actions)) {
      this.access.hero.idle()
      this.access.controls.setEnabled(false)

      return
    }

    const previousRoom = this.access.buildings.activeRoomId
    const onStairs = this.access.buildings.update(
      this.access.hero,
      delta,
      actions,
      this.access.services.lockpicking,
      this.access.transitionBuilding
    )
    if (this.access.buildings.activeRoomId !== previousRoom) this.access.services.audio.cue('door')

    if (isGameplayBlocked(this.access.services)) {
      this.access.hero.cancelAttackPreparation()
      this.access.hero.idle()
      this.access.controls.setEnabled(false)

      return
    }

    this.access.syncContext()
    if (!onStairs) this.access.hero.update(delta, this.access.buildings.movementBounds(this.access.width), actions, platforms)

    if (this.access.boundaryTravel.update(this.access.hero.sprite.x, this.access.buildings.movementBounds(this.access.width),
      !this.access.buildings.isInside && this.access.hero.canInteract)) {
      this.access.hero.idle()
      this.access.controls.setEnabled(false)
    }

    if (!onStairs && this.access.hero.canInteract) this.access.savePosition()
  }
}
