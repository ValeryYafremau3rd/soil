import type Phaser from 'phaser'

/** Sprite and entity callbacks used to finish death without owning combat state. */
interface PatrolDeathAccess {
  sprite: Phaser.GameObjects.Sprite
  health(): number
  hide(): void
  onCorpse?: () => void
}

/** Owns death animation completion, corpse creation and the final visibility hold. */
export class PatrolDeathController {
  private readonly access: PatrolDeathAccess
  private readonly animation: string
  private readonly holdDuration: number
  private dying = false
  private complete = false
  private remainingMs = 0
  private corpseCreated = false

  /**
   * Bind death presentation to one patrol and its scene-owned sprite.
   * @param {PatrolDeathAccess} access - Sprite, live health and completion callbacks.
   * @param {string} animation - Authored death animation key.
   * @param {number} holdDuration - Milliseconds to hold completed art without a corpse callback.
   */
  constructor(access: PatrolDeathAccess, animation: string, holdDuration: number) {
    this.access = access
    this.animation = animation
    this.holdDuration = holdDuration
  }

  /** @returns {boolean} Whether death presentation may still make the patrol visible. */
  get visible(): boolean {
    return this.dying
  }

  /**
   * Start the death animation and wait for its completion before creating loot.
   * @returns {void} Registers one sprite completion callback for this death.
   */
  begin(): void {
    this.dying = true
    this.access.sprite.clearTint().play(this.animation)
    this.access.sprite.once(`animationcomplete-${this.animation}`, () => {
      this.complete = true
      this.remainingMs = this.holdDuration
      this.leaveCorpse()
    })
  }

  /**
   * Advance completed death presentation in gameplay time.
   * @param {number} elapsed - Clamped gameplay milliseconds since the previous update.
   * @returns {void} Resumes death animation or hides expired presentation.
   */
  update(elapsed: number): void {
    this.access.sprite.anims.timeScale = 1
    if (!this.dying) return

    this.access.sprite.anims.resume()
    if (!this.complete) return

    this.remainingMs = Math.max(0, this.remainingMs - elapsed)
    if (this.remainingMs === 0) this.finish()
  }

  /**
   * Emit authored corpse loot at most once after animation completion.
   * @returns {void} Leaves presentation active when no corpse callback is supplied.
   */
  private leaveCorpse(): void {
    if (this.access.health() > 0 || !this.access.onCorpse || this.corpseCreated) return

    this.corpseCreated = true
    this.access.onCorpse()
    this.finish()
  }

  /**
   * Remove this actor from active rendering and interaction.
   * @returns {void} Updates owned death state before notifying the entity.
   */
  private finish(): void {
    this.dying = false
    this.access.sprite.setActive(false)
    this.access.hide()
  }
}
