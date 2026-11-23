/**
 * Movement speed and walk/pause durations used by wandering actors.
 */
export interface WanderSettings {
  speed: number
  minWalkMs: number
  maxWalkMs: number
  minPauseMs: number
  maxPauseMs: number
}

/** Alternates walking and standing; injected randomness makes movement reproducible in tests. */
export class Wanderer {
  x: number
  direction: number
  walking = true
  private remainingMs: number
  private readonly bounds: {
    left: number
    right: number
  }
  private readonly settings: WanderSettings
  private readonly random: () => number

  /**
   * Initialize the Wanderer instance and its collaborators.
   * @param {number} x - Horizontal coordinate.
   * @param {{ left: number; right: number; }} bounds - The bounds supplied to this operation.
   * @param {WanderSettings} settings - Configuration values for this instance.
   * @param {() => number} random - Random-number source; injectable for deterministic results.
   * @returns {Wanderer} The initialized instance.
   */
  constructor(
    x: number,
    bounds: {
      left: number
      right: number
    },
    settings: WanderSettings,
    random = Math.random
  ) {
    this.bounds = bounds
    this.settings = settings
    this.random = random
    this.x = Math.max(bounds.left, Math.min(bounds.right, x))
    this.direction = random() < 0.5 ? -1 : 1
    this.remainingMs = this.duration(settings.minWalkMs, settings.maxWalkMs)
  }

  /**
   * Perform duration for Wanderer.
   * @param {number} min - The min supplied to this operation.
   * @param {number} max - The max supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  private duration(
    min: number,
    max: number
  ): number {
    return min + this.random() * (max - min)
  }

  /**
   * Perform update for Wanderer.
   * @param {number} deltaMs - Elapsed gameplay time in milliseconds.
   * @returns {void} Completes the operation without returning a value.
   */
  update(deltaMs: number): void {
    let remaining = Math.max(0, deltaMs)
    while (remaining > 0) {
      const elapsed = Math.min(remaining, this.remainingMs)
      let reachedEdge = false
      if (this.walking) {
        this.x = Math.max(this.bounds.left, Math.min(this.bounds.right,
          this.x + this.direction * this.settings.speed * elapsed / 1000))
        reachedEdge = this.x === this.bounds.left || this.x === this.bounds.right
        if (reachedEdge) this.direction = this.x === this.bounds.left ? 1 : -1
      }

      remaining -= elapsed
      this.remainingMs -= elapsed
      if (this.remainingMs <= 0 || reachedEdge) {
        this.walking = !this.walking
        const config = this.settings
        this.remainingMs = this.walking ? this.duration(config.minWalkMs, config.maxWalkMs)
          : this.duration(config.minPauseMs, config.maxPauseMs)
      }
    }
  }
}
