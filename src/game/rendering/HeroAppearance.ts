import type Phaser from 'phaser'
import { HERO_ACTION, HERO_ANIMATIONS, HERO_ANIMATION_STEPS, HERO_OUTFITS, heroFrameKey } from '../../content/hero'
import { prepareHeroFrames } from './prepareHeroAnimations'

/** Local animation keys preserve Hero's action checks and completion events. */
export class HeroAppearance {
  private outfit?: string
  private readonly scene: Phaser.Scene
  private readonly sprite: Phaser.GameObjects.Sprite

  /**
   * Initialize the HeroAppearance instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {Sprite} sprite - The sprite supplied to this operation.
   * @returns {HeroAppearance} The initialized instance.
   */
  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {
    this.scene = scene
    this.sprite = sprite
  }

  /**
   * Perform frame key for HeroAppearance.
   * @param {string} action - The action supplied to this operation.
   * @param {number} index - The index supplied to this operation.
   * @returns {string} The resolved text value.
   */
  frameKey(action: string, index: number): string {
    const key = heroFrameKey(action, index)

    return this.outfit ? `${this.outfit}:${key}` : key
  }

  /**
   * Set clothing.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @returns {void} Completes the operation without returning a value.
   */
  setClothing(itemId?: string): void {
    const outfit = itemId && HERO_OUTFITS[itemId] ? itemId : undefined
    if (outfit === this.outfit) return

    const state = this.sprite.anims
    const action = state.currentAnim?.key ?? HERO_ACTION.idle
    const progress = state.getProgress()
    const playing = state.isPlaying
    // Hidden poses use a texture directly; they must stay hidden during equipment changes.
    const textureKey = this.sprite.texture.key.split(':').pop()!
    state.stop()
    this.outfit = outfit
    if (outfit) prepareHeroFrames(this.scene, outfit)

    const steps = outfit ? HERO_OUTFITS[outfit].steps : HERO_ANIMATION_STEPS

    for (const key of Object.values(HERO_ACTION)) {
      if (state.exists(key)) state.remove(key)

      state.create({
        key, frames: steps[key].map((_, index) => ({ key: this.frameKey(key, index) })),
        ...HERO_ANIMATIONS[key]
      })
    }

    state.play(action)
    state.setProgress(progress)
    if (!playing) {
      state.stop()
      this.sprite.setTexture(this.outfit ? `${this.outfit}:${textureKey}` : textureKey)
    }
  }
}
