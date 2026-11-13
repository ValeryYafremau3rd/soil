import type Phaser from 'phaser'
import type { NpcDefinition } from '../../content/npcs'
import { createCutoutTexture } from '../rendering/createCutoutTexture'
import { InteractiveObject } from '../interactive/InteractiveObject'
import type { Rect } from '../../content/types'
import { cleanNpcFrame } from '../rendering/cleanNpcFrame'
import { prepareNpcTexture } from '../rendering/prepareNpcTexture'

function prepareAnimation(scene: Phaser.Scene, definition: NpcDefinition, texture: Phaser.Textures.CanvasTexture,
  key: string, steps: readonly Rect[], frameRate: number, repeat: number, prefix = '') {
  const ratio = texture.getSourceImage().width / definition.referenceWidth
  const frames = steps.map((step, index) => {
    const frame = `${prefix}${index}`
    if (!texture.has(frame)) {
      const x = Math.round(step.x * ratio), y = Math.round(step.y * ratio)
      const width = Math.round(step.width * ratio), height = Math.round(step.height * ratio)
      texture.add(frame, 0, x, y, width, height)
      if (definition.backgroundThreshold !== undefined) {
        // Key each cropped frame separately: panel borders on an atlas can enclose its backdrop.
        const pixels = texture.context.getImageData(x, y, width, height)
        cleanNpcFrame(pixels.data, width, height, definition)
        texture.context.putImageData(pixels, x, y)
      }
    }
    return { key: definition.textureKey, frame }
  })
  texture.refresh()
  if (!scene.anims.exists(key)) scene.anims.create({ key, frames, frameRate, repeat })
  return frames[0].frame
}

function createNpcSprite(scene: Phaser.Scene, definition: NpcDefinition, x: number, groundY: number) {
  if (definition.frameSize) prepareNpcTexture(scene, definition)
  else createCutoutTexture(scene, definition.sourceKey, definition.textureKey, definition.background ?? 'light')
  const texture = scene.textures.get(definition.textureKey) as Phaser.Textures.CanvasTexture
  const firstFrame = prepareAnimation(scene, definition, texture, definition.idleAnimation,
    definition.idleSteps, definition.frameRate, definition.repeat ?? -1)
  if (definition.walk) prepareAnimation(scene, definition, texture, definition.walk.key,
    definition.walk.steps, definition.walk.frameRate, -1, `${definition.walk.key}:`)
  if (definition.run) prepareAnimation(scene, definition, texture, definition.run.key,
    definition.run.steps, definition.run.frameRate, -1, `${definition.run.key}:`)
  if (definition.attack) prepareAnimation(scene, definition, texture, definition.attack.key,
    definition.attack.steps, definition.attack.frameRate, 0, `${definition.attack.key}:`)
  if (definition.shoot) prepareAnimation(scene, definition, texture, definition.shoot.key,
    definition.shoot.steps, definition.shoot.frameRate, 0, `${definition.shoot.key}:`)
  if (definition.death) prepareAnimation(scene, definition, texture, definition.death.key,
    definition.death.steps, definition.death.frameRate, 0, `${definition.death.key}:`)
  const sprite = scene.add.sprite(x, groundY, definition.textureKey, firstFrame).setOrigin(0.5, 1).setDepth(definition.depth)
  return sprite.setScale(definition.displayHeight * (definition.scale ?? 1) / (definition.frameSize?.referenceHeight ?? sprite.height))
}

export abstract class Npc extends InteractiveObject<Phaser.GameObjects.Sprite> {
  protected readonly definition: NpcDefinition

  static preloadAssets(scene: Phaser.Scene, definition: NpcDefinition): void {
    if (!scene.textures.exists(definition.sourceKey)) scene.load.image(definition.sourceKey, `${import.meta.env.BASE_URL}${definition.path}`)
  }

  constructor(scene: Phaser.Scene, definition: NpcDefinition, x: number, groundY: number) {
    super(scene, createNpcSprite(scene, definition, x, groundY), definition.interactionRadius,
      `Enter · Talk to ${definition.name}`, 'object')
    this.definition = definition
    this.idle()
  }

  idle(): void { this.sprite.play(this.definition.idleAnimation, true) }
}
