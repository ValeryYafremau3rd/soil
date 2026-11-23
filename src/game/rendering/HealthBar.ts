import type Phaser from 'phaser'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'

/** Owns the graphics and styling; combat supplies only position and health. */
export class HealthBar {
  private readonly graphics: Phaser.GameObjects.Graphics

  /**
   * Initialize the HealthBar instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {HealthBar} The initialized instance.
   */
  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(WORLD_LAYERS.hints)
  }

  /**
   * Perform draw for HealthBar.
   * @param {number} x - Horizontal coordinate.
   * @param {number} y - Vertical coordinate.
   * @param {number} health - The health supplied to this operation.
   * @param {number} maximum - The maximum supplied to this operation.
   * @param {boolean} visible - Whether the presentation should be visible.
   * @returns {void} Completes the operation without returning a value.
   */
  draw(
    x: number,
    y: number,
    health: number,
    maximum: number,
    visible: boolean
  ): void {
    const settings = GAME_SETTINGS.combatFeedback.healthBar
    this.graphics.clear().setPosition(x - settings.width / 2, y - settings.offsetY)
      .fillStyle(settings.backgroundColor).fillRect(0, 0, settings.width, settings.height)
      .fillStyle(settings.fillColor).fillRect(
        0,
        0,
        settings.width * health / maximum,
        settings.height
      )
      .setVisible(visible)
  }

  /**
   * Set visible.
   * @param {boolean} visible - Whether the presentation should be visible.
   * @returns {void} Completes the operation without returning a value.
   */
  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible)
  }

  /**
   * Perform destroy for HealthBar.
   * @returns {void} Completes the operation without returning a value.
   */
  destroy(): void {
    this.graphics.destroy()
  }
}
