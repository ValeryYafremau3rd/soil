import Phaser from 'phaser'
import type { LoadingController } from '../../app/contracts/loading'
import { UI_CONFIG } from '../../content/ui'

/** Keeps a location covered until rendering settles, and owns its render listeners. */
export class LocationReadiness {
  private stableFrames = 0
  private previousFrame = performance.now()
  private revealStarted: number | null = null
  private readonly scene: Phaser.Scene
  private readonly loading: LoadingController
  private readonly onReady?: () => void

  /**
   * Observe real rendered frames after scene construction, including while menus pause it.
   * @param {Phaser.Scene} scene - Scene whose initial texture uploads must finish.
   * @param {LoadingController} loading - Owner of the blocking loading overlay.
   * @param {() => void} [onReady] - Notify React once the covered world is ready to reveal.
   */
  constructor(scene: Phaser.Scene, loading: LoadingController, onReady?: () => void) {
    this.scene = scene
    this.loading = loading
    this.onReady = onReady
    scene.game.events.on(Phaser.Core.Events.POST_RENDER, this.afterRender)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy)
  }

  /**
   * Wait for consecutive responsive frames before starting the visible fade.
   * @returns {void} Updates loading only after rendering has returned control.
   */
  private afterRender = (): void => {
    const now = performance.now()
    const elapsed = now - this.previousFrame
    this.previousFrame = now
    if (this.revealStarted !== null) {
      if (now - this.revealStarted >= this.loading.fadeMs) {
        this.loading.finish()
        this.destroy()
      }
      return
    }

    const { readyFrames, readyFrameMaxMs } = UI_CONFIG.locationTransition
    this.stableFrames = elapsed <= readyFrameMaxMs ? this.stableFrames + 1 : 0
    if (this.stableFrames < readyFrames) return

    this.revealStarted = now
    this.onReady?.()
    this.loading.ready()
  }

  /**
   * Release the game listener on completion or when the scene is replaced.
   * @returns {void} Prevents an obsolete location from finishing another loading cycle.
   */
  private destroy = (): void => {
    this.scene.game.events.off(Phaser.Core.Events.POST_RENDER, this.afterRender)
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy)
  }
}
