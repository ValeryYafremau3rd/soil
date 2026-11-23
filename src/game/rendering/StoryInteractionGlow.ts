import type Phaser from 'phaser'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'

/** Owns the glowing world marker for a readable story point or disappearance notice. */
export class StoryInteractionGlow {
  private readonly marker: Phaser.GameObjects.Text
  private readonly scene: Phaser.Scene

  /**
   * Place a small luminous marker above the investigation's authored coordinates.
   * @param {Phaser.Scene} scene - Scene owning the text texture and animation clock.
   * @param {Phaser.GameObjects.Text} hint - Reading prompt controlling resource lifetime.
   * @param {number} x - Investigation position in world pixels.
   * @param {number} y - Investigation floor height in world pixels.
   */
  constructor(scene: Phaser.Scene, hint: Phaser.GameObjects.Text, x: number, y: number) {
    this.scene = scene
    const style = GAME_SETTINGS.interaction.storyGlow
    this.marker = scene.add.text(x, y - style.offsetY, style.label, style.style)
      .setOrigin(0.5, 1).setDepth(WORLD_LAYERS.hints - 1).setVisible(false)
      .setName('story-interaction-glow')
      .setShadow(0, 0, style.shadowColor, style.shadowBlur, true, true)
    hint.once('destroy', this.destroy)
  }

  /**
   * Show distant notices in the correct context and emphasize the selected nearby action.
   * @param {boolean} visible - Whether the story point belongs to the current world context.
   * @param {boolean} selected - Whether its reading prompt is selected and within reach.
   * @returns {void} Updates a gentle alpha pulse without drawing a ground marker.
   */
  update(visible: boolean, selected: boolean): void {
    this.marker.setVisible(visible)
    if (!visible) return

    const style = GAME_SETTINGS.interaction.storyGlow
    const pulse = (Math.sin(this.scene.time.now / style.periodMs * Math.PI * 2) + 1) / 2
    this.marker.setAlpha(style.minAlpha + (style.maxAlpha - style.minAlpha) * pulse)
      .setScale(selected ? style.selectedScale : 1)
  }

  /**
   * Release the text and its shadow texture together with the owning reading prompt.
   * @returns {void} Safe to call while Phaser tears down the scene.
   */
  private destroy = (): void => {
    this.marker.destroy()
  }
}
