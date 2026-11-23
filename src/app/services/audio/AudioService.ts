import type { AudioConfig, AudioController, AudioPlayback } from '../../contracts/audio.ts'
import type { GameServices } from '../../contracts/game.ts'
import { isMenuOpen } from '../session/isGameplayBlocked.ts'

// Preserve sound preference across session replacement.
let soundEnabled = true

/**
 * Owns audio service state and behavior.
 */
export class AudioService implements AudioController {
  private readonly listeners = new Set<() => void>()

  /**
   * Perform subscribe for AudioService.
   * @param {() => void} listener - Callback invoked when the observable value changes.
   * @returns {() => void} Callback that releases or performs the registered operation.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Read snapshot.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  getSnapshot = (): boolean => soundEnabled

  /**
   * Perform toggle sound for AudioService.
   * @returns {void} Completes the operation without returning a value.
   */
  toggleSound = (): void => {
    soundEnabled = !soundEnabled
    this.playback?.setMuted?.(!soundEnabled)
    this.listeners.forEach(listener => listener())
  }
  private playback?: AudioPlayback
  private uiActionPending = false
  private running = false
  private inside = false
  private pursuit: 'human' | 'monster' | null = null
  private setup = true
  private ending = false
  private services?: GameServices
  private readonly config: AudioConfig

  /**
   * Initialize the AudioService instance and its collaborators.
   * @param {AudioConfig} config - Configuration consumed by this operation.
   * @returns {AudioService} The initialized instance.
   */
  constructor(config: AudioConfig) {
    this.config = config
  }

  /**
   * Perform attach for AudioService.
   * @param {AudioPlayback} playback - The playback supplied to this operation.
   * @param {GameServices} services - The services supplied to this operation.
   * @returns {() => void} Callback that releases or performs the registered operation.
   */
  attach(
    playback: AudioPlayback,
    services: GameServices
  ): () => void {
    this.playback = playback
    playback.setMuted?.(!soundEnabled)
    this.services = services
    const windows = [
      () => services.hud.getSnapshot().menuId,
      () => services.inventory.getSnapshot().menu,
      () => services.travel.getSnapshot().menuOpen,
      () => services.dialogue.getSnapshot().conversation,
      () => services.rest.getSnapshot().menu,
      () => services.lockpicking.getSnapshot().puzzle,
      () => services.quests.getSnapshot().boardOpen
    ]
    let previous = windows.map((read, index) => index === 0 ? read() : Boolean(read()))

    /**
     * Perform sync windows.
     * @returns {void} Completes the operation without returning a value.
     */
    const syncWindows = () => {
      const next = windows.map((read, index) => index === 0 ? read() : Boolean(read()))
      if (!this.isEnding() && next.some((open, i) => open !== previous[i])) this.cue('ui')

      previous = next
      this.refresh()
    }
    const releases = [services.hud, services.inventory, services.travel, services.dialogue,
    services.rest, services.lockpicking, services.quests].map(store => store.subscribe(syncWindows))
    // Observe the edge, so later updates and attaching to a dead save stay silent.
    let dead = services.status.getSnapshot().health <= 0
    releases.push(services.status.subscribe(() => {
      const nextDead = services.status.getSnapshot().health <= 0
      const died = !dead && nextDead
      dead = nextDead
      if (died) this.cue('death')
    }))
    releases.push(...[services.loading, services.daytime, services.travel, services.status,
      services.story].map(store => store.subscribe(this.refresh)))
    this.refresh()

    return () => {
      releases.forEach(release => release())
      playback.dispose()
      this.playback = undefined
      this.services = undefined
    }
  }

  /**
   * Set running.
   * @param {boolean} running - The running supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  setRunning(running: boolean): void {
    if (running === this.running) return

    this.running = running
    this.refresh()
  }

  /**
   * Set setup.
   * @param {boolean} setup - The setup supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  setSetup(setup: boolean): void {
    this.setup = setup
    this.refresh()
  }

  /**
   * Play an authored cue, coalescing UI feedback from one input task.
   * @param {string} event - Audio event ID; UI feedback remains available during endings.
   * @returns {void} Respects mute and suppresses gameplay effects after departure.
   */
  cue(event: string): void {
    if (event === 'ui') {
      if (this.uiActionPending) return

      this.uiActionPending = true
      // React commits and native control changes can follow the original input handler.
      setTimeout(() => { this.uiActionPending = false }, 0)
    }

    const id = this.config.events[event]
    if (id && soundEnabled && (event === 'ui' || !this.isEnding())) {
      this.playback?.play(id, this.volume(id))
    }
  }

  /**
   * Perform spotted for AudioService.
   * @param {string} type - The type supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  spotted(type: string): void {
    const id = this.config.spotted[type] ?? this.config.spotted.monster
    if (id && soundEnabled && !this.isEnding()) this.playback?.play(id, this.volume(id))
  }

  /**
   * Set world.
   * @param {boolean} inside - The inside supplied to this operation.
   * @param {"human" | "monster" | null} pursuit - The pursuit supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  setWorld(inside: boolean, pursuit: 'human' | 'monster' | null): void {
    if (this.inside === inside && this.pursuit === pursuit) return

    this.inside = inside
    this.pursuit = pursuit
    this.refresh()
  }

  /**
   * Perform volume for AudioService.
   * @param {string} id - The id supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  private volume(id: string): number {
    return this.config.masterVolume * this.config.tracks[id].volume
  }

  /**
   * Read completion directly so cues are suppressed before story subscribers run.
   * @returns {boolean} Whether the ending presentation owns audio.
   */
  private isEnding(): boolean {
    return Boolean(this.services?.story.getSnapshot().flags.prologue_complete)
  }

  /**
   * Perform refresh for AudioService.
   * @returns {void} Completes the operation without returning a value.
   */
  private refresh = (): void => {
    const services = this.services
    if (!services) return

    const tracks = new Map<string, number>()
    const ending = this.isEnding()
    if (ending && !this.ending) this.playback?.stopEffects()
    this.ending = ending

    /**
     * Perform add.
     * @param {string} id - The id supplied to this operation.
     * @param {number} gain - The gain supplied to this operation.
     * @returns {Map<string, number>} The result described by the TypeScript return signature.
     */
    const add = (id: string, gain = 1) => tracks.set(id, this.volume(id) * gain)
    // Travel and door loading overlays do not change the active audio conditions.
    // Only initial setup uses the theme; established world loops keep their position.
    if (ending) add(this.config.music.ending)
    else if (this.setup) add(this.config.music.loading)
    else if (services.status.getSnapshot().health > 0) {
      if (this.running && !isMenuOpen(services)) add(this.config.running)

      const night = services.daytime.getSnapshot().phase === 'night'

      for (const mix of [...(this.config.locations[services.travel.getSnapshot().currentLocationId] ?? []),
      ...(night ? this.config.nightAmbient : [])]) add(mix.track, this.inside ? mix.inside : mix.outside)

      if (this.pursuit) add(this.config.pursuit[this.pursuit])
      else {
        // One track per day, alternating the authored daytime selection.
        const music = night ? this.config.music.night : this.config.music.daytime
        if (music.length) add(music[(services.daytime.getSnapshot().day - 1) % music.length])
      }
    }

    this.playback?.mix(tracks)
  }
}
