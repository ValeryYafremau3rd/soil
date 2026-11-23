import type Phaser from 'phaser'
import type { AttackTiming } from '../../domain/combat/attackTiming'
import { HERO_SETTINGS } from '../../content/hero'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'

/** Small world overlay: no modal state, pause, or input capture. */
export class AttackTimingOverlay {
  private readonly scene: Phaser.Scene
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text

  /**
   * Initialize the AttackTimingOverlay instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {AttackTimingOverlay} The initialized instance.
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(WORLD_LAYERS.hints + 10).setVisible(false)
    this.label = scene.add.text(
      0,
      0,
      '',
      {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#10151d',
        strokeThickness: 4
      }
    )
      .setOrigin(0.5).setScrollFactor(0).setDepth(WORLD_LAYERS.hints + 11).setVisible(false)
  }

  /**
   * Perform hide for AttackTimingOverlay.
   * @returns {void} Completes the operation without returning a value.
   */
  hide(): void {
    this.graphics.clear().setVisible(false)
    this.label.setVisible(false)
  }

  /**
   * Perform show damage for AttackTimingOverlay.
   * @param {number} amount - Amount to apply to the operation.
   * @returns {void} Completes the operation without returning a value.
   */
  showDamage(amount: number): void {
    const settings = HERO_SETTINGS.attackTiming
    const x = this.scene.cameras.main.width / 2, y = this.scene.cameras.main.height / 2 - settings.feedbackOffset
    const color = amount > 0 ? settings.perfectColor : settings.dotColor
    const text = this.scene.add.text(
      x,
      y,
      amount > 0 ? `You dealt ${amount} damage` : 'Miss',
      {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        stroke: '#10151d',
        strokeThickness: 5,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(WORLD_LAYERS.hints + 12)
    this.scene.tweens.add({
      targets: text, y: y - 45, alpha: 0, duration: settings.feedbackDurationMs,
      onComplete: () => text.destroy()
    })
  }

  /**
   * Perform update for AttackTimingOverlay.
   * @param {AttackTiming} timing - The timing supplied to this operation.
   * @param {string | undefined} releaseControl - The release control supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  update(
    timing: AttackTiming,
    releaseControl?: string
  ): void {
    if (!timing.active) {
      this.hide()

      return
    }

    const settings = HERO_SETTINGS.attackTiming
    const x = this.scene.cameras.main.width / 2, y = this.scene.cameras.main.height / 2
    const radius = settings.dotRadius + (settings.radius - settings.dotRadius) * timing.radiusRatio
    const color = timing.radiusRatio < 0.15 ? settings.perfectColor : settings.ringColor
    this.graphics.clear().setVisible(true).lineStyle(settings.lineWidth + 2, 0x10151d, 0.9).strokeCircle(
      x,
      y,
      radius
    )
      .lineStyle(
        settings.lineWidth,
        color
      ).strokeCircle(
        x,
        y,
        radius
      ).fillStyle(settings.dotColor).fillCircle(
        x,
        y,
        settings.dotRadius
      )
    const key = releaseControl ?? (timing.kind === 'melee' ? GAME_SETTINGS.input.fight : GAME_SETTINGS.input.shoot)
    this.label.setVisible(true).setPosition(x, y + settings.radius + 24).setText(`Release ${key} · ${timing.damageMultiplier.toFixed(2)}× damage`)
  }
}
