import type Phaser from 'phaser'
import { GAME_SETTINGS } from '../../content/world'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { createWorldHint, isSelectedHint } from '../rendering/createWorldHint'

/**
 * Owns interactive object state and behavior.
 */
export abstract class InteractiveObject<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite = Phaser.GameObjects.Image> {
  readonly sprite: T
  private readonly hint: Phaser.GameObjects.Text
  private readonly radius: number
  private readonly hintAnchor: 'actor' | 'object'
  private readonly interactionOffsetY: number

  /**
   * Initialize the InteractiveObject instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {T} sprite - The sprite supplied to this operation.
   * @param {number} radius - The radius supplied to this operation.
   * @param {string} prompt - The prompt supplied to this operation.
   * @param {"object" | "actor"} hintAnchor - The hint anchor supplied to this operation.
   * @param {number} interactionOffsetY - The interaction offset y supplied to this operation.
   * @returns {InteractiveObject} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    sprite: T,
    radius: number,
    prompt: string,
    hintAnchor: 'actor' | 'object' = 'actor',
    interactionOffsetY = 0
  ) {
    this.sprite = sprite
    this.radius = radius
    this.hintAnchor = hintAnchor
    this.interactionOffsetY = interactionOffsetY
    this.hint = createWorldHint(scene, sprite.x, sprite.y, prompt)
  }

  /**
   * Perform update for InteractiveObject.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {InputActions} actions - The actions supplied to this operation.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  update(
    hero: Hero,
    actions: InputActions,
    enabled = true
  ): boolean {
    const nearby = enabled && this.canInteractWith(hero)
    const anchor = this.hintAnchor === 'actor' ? hero.sprite : this.sprite
    this.hint.setVisible(nearby).setPosition(
      anchor.x,
      anchor.y - anchor.displayHeight - GAME_SETTINGS.interaction.hintGap
    )
    if (!nearby || !(actions.interactPressed && isSelectedHint(this.hint))) return false

    this.hint.setVisible(false)
    this.interact()

    return true
  }

  /**
   * Check whether interact with is allowed.
   * @param {Hero} hero - The hero supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canInteractWith(hero: Hero): boolean {
    // Wall-mounted props interact at their floor even when their art is raised.
    const interactionY = this.sprite.y + this.interactionOffsetY

    return this.sprite.visible && hero.canInteract && Math.abs(hero.sprite.x - this.sprite.x) <= this.radius
      && hero.sprite.y >= interactionY - this.sprite.displayHeight - GAME_SETTINGS.interaction.verticalTolerance
      && hero.sprite.y <= interactionY + GAME_SETTINGS.interaction.verticalTolerance
  }

  /**
   * Set visible.
   * @param {boolean} visible - Whether the presentation should be visible.
   * @returns {void} Completes the operation without returning a value.
   */
  setVisible(visible: boolean): void {
    this.sprite.setVisible(visible)
    if (!visible) this.hint.setVisible(false)
  }

  /**
   * Set prompt.
   * @param {string} text - The text supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  protected setPrompt(text: string): void {
    if (this.hint.text !== text) this.hint.setText(text).setWordWrapWidth(GAME_SETTINGS.interaction.hintWidth)
  }

  /**
   * Perform destroy for InteractiveObject.
   * @returns {void} Completes the operation without returning a value.
   */
  destroy(): void {
    this.hint.destroy()
    this.sprite.destroy()
  }

  /**
   * Perform interact for InteractiveObject.
   * @returns {void} Completes the operation without returning a value.
   */
  protected abstract interact(): void
}
