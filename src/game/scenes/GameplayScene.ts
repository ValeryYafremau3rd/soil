import Phaser from 'phaser'
import { LocationReadiness } from './LocationReadiness'
import type { GameServices } from '../../app/contracts/game'
import { LocationWorld } from '../locations/LocationWorld'
import { isMenuOpen } from '../../app/services/session/isGameplayBlocked'

/**
 * Owns the playable Phaser scene, location restarts, menu pauses and death completion.
 */
export class GameplayScene extends Phaser.Scene {
  private readonly services: GameServices
  private world?: LocationWorld
  private journey = 0
  private difficultyId = ''
  private readonly onReady?: () => void
  private readonly onDeathComplete?: () => void
  private deathNotified = false
  private restarting = false

  /**
   * Initialize the GameplayScene instance and its collaborators.
   * @param {GameServices} services - The services supplied to this operation.
   * @param {(() => void) | undefined} onReady - The on ready supplied to this operation.
   * @param {(() => void) | undefined} onDeathComplete - The on death complete supplied to this operation.
   * @returns {GameplayScene} The initialized instance.
   */
  constructor(
    services: GameServices,
    onReady?: () => void,
    onDeathComplete?: () => void
  ) {
    super('gameplay')
    this.services = services
    this.onReady = onReady
    this.onDeathComplete = onDeathComplete
  }

  /**
   * Perform location for GameplayScene.
   * @returns {TravelLocation} The result described by the TypeScript return signature.
   */
  private get location() {
    const snapshot = this.services.travel.getSnapshot()
    const location = snapshot.locations.find(candidate => candidate.id === snapshot.currentLocationId)
    if (!location) throw new Error('Travel destination is unavailable')

    return location
  }

  /**
   * Perform preload for GameplayScene.
   * @returns {void} Completes the operation without returning a value.
   */
  preload(): void {
    this.services.loading.begin(this.location.name, false)
    LocationWorld.preload(this, this.location)
  }

  /**
   * Perform create for GameplayScene.
   * @returns {void} Completes the operation without returning a value.
   */
  create(): void {
    this.deathNotified = false
    this.restarting = false
    this.world = new LocationWorld(this, this.location, this.services)
    this.journey = this.services.travel.getSnapshot().journey
    this.difficultyId = this.services.difficulty.id
    new LocationReadiness(this, this.services.loading, this.onReady)

    /**
     * Queue the scene state matching the latest menu snapshot.
     * @returns {void} Keeps rapid menu transitions ordered before the next Phaser update.
     */
    const syncPause = () => {
      if (isMenuOpen(this.services)) {
        this.world?.pause()
        this.scene.pause()
      } else {
        // Resume must follow any queued pause, even before Phaser applies that pause.
        this.scene.resume()
      }
    }
    const unsubscribeMenus = [
      this.services.hud,
      this.services.inventory,
      this.services.travel,
      this.services.dialogue,
      this.services.rest,
      this.services.lockpicking,
      this.services.quests
    ]
      .map(store => store.subscribe(syncPause))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of unsubscribeMenus) unsubscribe()
    })
    syncPause()
    // Phaser destroys scene-owned objects; releasing the composition also releases its references.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.world = undefined
    })
  }

  /**
   * Perform update for GameplayScene.
   * @param {number} _time - The  time supplied to this operation.
   * @param {number} delta - Elapsed time since the previous update.
   * @returns {void} Completes the operation without returning a value.
   */
  update(
    _time: number,
    delta: number
  ): void {
    if (this.services.travel.getSnapshot().journey !== this.journey || this.services.difficulty.id !== this.difficultyId) {
      if (!this.restarting) {
        this.restarting = true
        this.services.loading.begin(this.location.name)
        this.time.delayedCall(this.services.loading.fadeMs, () => {
          this.services.loading.covered()
          this.scene.restart()
        })
      }

      this.world?.update(delta)

      return
    }

    this.world?.update(delta)
    if (this.world?.heroDeathComplete && !this.deathNotified) {
      this.deathNotified = true
      this.onDeathComplete?.()
    }
  }
}
