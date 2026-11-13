import type Phaser from 'phaser'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'

/** Owns the graphics and styling; combat supplies only position and health. */
export class HealthBar {
  private readonly graphics: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(WORLD_LAYERS.hints)
  }

  draw(x: number, y: number, health: number, maximum: number, visible: boolean): void {
    const settings = GAME_SETTINGS.combatFeedback.healthBar
    this.graphics.clear().setPosition(x - settings.width / 2, y - settings.offsetY)
      .fillStyle(settings.backgroundColor).fillRect(0, 0, settings.width, settings.height)
      .fillStyle(settings.fillColor).fillRect(0, 0, settings.width * health / maximum, settings.height)
      .setVisible(visible)
  }

  setVisible(visible: boolean): void { this.graphics.setVisible(visible) }
  destroy(): void { this.graphics.destroy() }
}
