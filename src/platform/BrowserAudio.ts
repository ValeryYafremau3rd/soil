import type { AudioConfig, AudioPlayback } from '../app/contracts/audio'

const assets = import.meta.glob('../sounds/**/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** Browser policy may block autoplay; retry active loops on the next user gesture. */
export class BrowserAudio implements AudioPlayback {
  private muted = false

  /**
   * Set muted.
   * @param {boolean} muted - The muted supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  setMuted(muted: boolean): void {
    this.muted = muted

    for (const audio of [...this.loops.values(), ...this.effects]) audio.muted = muted
  }
  private readonly loops = new Map<string, HTMLAudioElement>()
  private readonly effects = new Set<HTMLAudioElement>()
  private uiEffect?: HTMLAudioElement
  private readonly config: AudioConfig

  /**
   * Initialize the BrowserAudio instance and its collaborators.
   * @param {AudioConfig} config - Configuration consumed by this operation.
   * @returns {BrowserAudio} The initialized instance.
   */
  constructor(config: AudioConfig) {
    this.config = config

    for (const { path } of Object.values(config.tracks)) {
      if (!assets[`../sounds/${path}`]) throw new Error(`audio.json: missing sound ${path}`)
    }

    document.addEventListener('pointerdown', this.unlock)
    document.addEventListener('keydown', this.unlock)
  }

  /**
   * Perform create for BrowserAudio.
   * @param {string} id - The id supplied to this operation.
   * @param {number} volume - The volume supplied to this operation.
   * @returns {HTMLAudioElement} The result described by the TypeScript return signature.
   */
  private create(id: string, volume: number): HTMLAudioElement {
    const audio = new Audio(assets[`../sounds/${this.config.tracks[id].path}`])
    audio.volume = volume
    audio.muted = this.muted

    return audio
  }

  /**
   * Perform start for BrowserAudio.
   * @param {HTMLAudioElement} audio - The audio supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private start(audio: HTMLAudioElement): void {
    void audio.play().catch(() => { /* Retry loops after a user gesture. */ })
  }

  /**
   * Perform unlock for BrowserAudio.
   * @returns {void} Completes the operation without returning a value.
   */
  private unlock = (): void => {
    for (const audio of this.loops.values()) if (audio.paused) this.start(audio)
  }

  /**
   * Play an effect, replacing the previous UI clip when starting another UI cue.
   * @param {string} id - Authored track ID; only the configured UI track replaces itself.
   * @param {number} volume - Final playback gain from zero to one.
   * @returns {void} Leaves unrelated one-shot effects and music loops playing.
   */
  play(id: string, volume: number): void {
    const ui = id === this.config.events.ui
    if (ui) this.stopUiEffect()

    const audio = this.create(id, volume)
    this.effects.add(audio)
    if (ui) this.uiEffect = audio

    /**
     * Forget a finished or rejected clip without clearing a newer UI replacement.
     * @returns {void} Releases only this clip's ownership of active effect state.
     */
    const release = () => {
      this.effects.delete(audio)
      if (this.uiEffect === audio) this.uiEffect = undefined
    }
    audio.onended = release
    audio.onerror = release
    void audio.play().catch(release)
  }

  /**
   * Release the previous UI clip before its replacement starts.
   * @returns {void} Cancels playback and excludes the old clip from active effects.
   */
  private stopUiEffect(): void {
    const audio = this.uiEffect
    if (!audio) return

    this.uiEffect = undefined
    this.effects.delete(audio)
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  /**
   * Perform mix for BrowserAudio.
   * @param {ReadonlyMap<string, number>} tracks - The tracks supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  mix(tracks: ReadonlyMap<string, number>): void {
    for (const [id, audio] of this.loops) if (!tracks.has(id)) {
      audio.pause()
      this.loops.delete(id)
    }

    for (const [id, volume] of tracks) {
      // A silent layer is still active; attenuation must not reset its playback.
      const existing = this.loops.get(id)
      if (existing) {
        existing.volume = volume
        continue
      }

      const audio = this.create(id, volume)
      audio.loop = true
      this.loops.set(id, audio)
      this.start(audio)
    }
  }

  /**
   * Stop and release effects when gameplay yields to the ending soundtrack.
   * @returns {void} Leaves active music loops intact.
   */
  stopEffects(): void {
    this.uiEffect = undefined
    for (const audio of this.effects) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    this.effects.clear()
  }

  /**
   * Perform dispose for BrowserAudio.
   * @returns {void} Completes the operation without returning a value.
   */
  dispose(): void {
    this.uiEffect = undefined
    document.removeEventListener('pointerdown', this.unlock)
    document.removeEventListener('keydown', this.unlock)

    for (const audio of [...this.loops.values(), ...this.effects]) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    this.loops.clear()
    this.effects.clear()
  }
}
