import type Phaser from 'phaser'
import { GAME_SETTINGS } from '../../content/world'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { createWorldHint, isSelectedHint } from '../rendering/createWorldHint'

export abstract class InteractiveObject<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite = Phaser.GameObjects.Image> {
  readonly sprite: T
  private readonly hint: Phaser.GameObjects.Text
  private readonly radius: number
  private readonly hintAnchor: 'actor' | 'object'
  private readonly interactionOffsetY: number

  constructor(scene: Phaser.Scene, sprite: T, radius: number, prompt: string, hintAnchor: 'actor' | 'object' = 'actor', interactionOffsetY = 0) {
    this.sprite = sprite
    this.radius = radius
    this.hintAnchor = hintAnchor
    this.interactionOffsetY = interactionOffsetY
    this.hint = createWorldHint(scene, sprite.x, sprite.y, prompt)
  }

  update(hero: Hero, actions: InputActions, enabled = true): boolean {
    const nearby = enabled && this.canInteractWith(hero)
    const anchor = this.hintAnchor === 'actor' ? hero.sprite : this.sprite
    this.hint.setVisible(nearby).setPosition(anchor.x, anchor.y - anchor.displayHeight - GAME_SETTINGS.interaction.hintGap)
    if (!nearby || !(actions.interactPressed && isSelectedHint(this.hint))) return false
    this.hint.setVisible(false)
    this.interact()
    return true
  }

  canInteractWith(hero: Hero): boolean {
    // Wall-mounted props interact at their floor even when their art is raised.
    const interactionY = this.sprite.y + this.interactionOffsetY
    return this.sprite.visible && hero.canInteract && Math.abs(hero.sprite.x - this.sprite.x) <= this.radius
      && hero.sprite.y >= interactionY - this.sprite.displayHeight - GAME_SETTINGS.interaction.verticalTolerance
      && hero.sprite.y <= interactionY + GAME_SETTINGS.interaction.verticalTolerance
  }

  setVisible(visible: boolean): void {
    this.sprite.setVisible(visible)
    if (!visible) this.hint.setVisible(false)
  }

  protected setPrompt(text: string): void {
    if (this.hint.text !== text) this.hint.setText(text).setWordWrapWidth(GAME_SETTINGS.interaction.hintWidth)
  }

  destroy(): void { this.hint.destroy(); this.sprite.destroy() }

  protected abstract interact(): void
}
