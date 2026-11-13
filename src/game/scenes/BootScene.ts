import Phaser from 'phaser'
import type { GameServices } from '../../app/contracts/game'
import { LocationWorld } from '../locations/LocationWorld'
import { isMenuOpen } from '../../app/services/isGameplayBlocked'

export class BootScene extends Phaser.Scene {
  private readonly services: GameServices
  private world?: LocationWorld
  private journey = 0
  private difficultyId = ''
  private readonly onReady?: () => void
  private readonly onDeathComplete?: () => void
  private deathNotified = false
  private restarting = false

  constructor(services: GameServices, onReady?: () => void, onDeathComplete?: () => void) {
    super('boot'); this.services = services; this.onReady = onReady; this.onDeathComplete = onDeathComplete
  }

  private get location() {
    const snapshot = this.services.travel.getSnapshot()
    const location = snapshot.locations.find(candidate => candidate.id === snapshot.currentLocationId)
    if (!location) throw new Error('Travel destination is unavailable')
    return location
  }

  preload(): void {
    this.services.loading.begin(this.location.name, false)
    LocationWorld.preload(this, this.location)
  }
  create(): void {
    this.deathNotified = false
    this.restarting = false
    this.world = new LocationWorld(this, this.location, this.services)
    this.journey = this.services.travel.getSnapshot().journey
    this.difficultyId = this.services.difficulty.id
    this.onReady?.()
    this.services.loading.ready()
    // Menus can pause this scene immediately; the loading overlay must still finish.
    const finishLoading = setTimeout(this.services.loading.finish, this.services.loading.fadeMs)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearTimeout(finishLoading))
    const syncPause = () => {
      if (isMenuOpen(this.services)) {
        this.world?.pause()
        this.scene.pause()
      } else if (this.scene.isPaused()) this.scene.resume()
    }
    const unsubscribeMenus = [this.services.hud, this.services.inventory, this.services.travel,
      this.services.dialogue, this.services.rest, this.services.lockpicking, this.services.quests]
      .map(store => store.subscribe(syncPause))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of unsubscribeMenus) unsubscribe()
    })
    syncPause()
    // Phaser destroys scene-owned objects; releasing the composition also releases its references.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.world = undefined })
  }
  update(_time: number, delta: number): void {
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
