import type Phaser from 'phaser'
import type { SpriteDefinition } from '../../content/types'
import { createCutoutTexture } from './createCutoutTexture'

const sourceKey = (path: string) => `source:${path}`

export function preloadSprites(scene: Phaser.Scene, sprites: readonly SpriteDefinition[]): void {
  const paths = new Set(sprites.map(sprite => sprite.path))
  for (const path of paths) {
    if (!scene.textures.exists(sourceKey(path))) scene.load.image(sourceKey(path), `${import.meta.env.BASE_URL}${path}`)
  }
}

/** Crop into reference coordinates once, so world geometry never depends on PNG resolution. */
export function prepareSprites(scene: Phaser.Scene, sprites: readonly SpriteDefinition[]): void {
  for (const sprite of sprites) {
    if (scene.textures.exists(sprite.key)) continue
    let key = sourceKey(sprite.path)
    if (sprite.background !== 'none') {
      const cutout = `${key}:${sprite.background}`
      createCutoutTexture(scene, key, cutout, sprite.background)
      key = cutout
    }
    const source = scene.textures.get(key).getSourceImage() as HTMLCanvasElement
    const ratio = sprite.referenceWidth ? source.width / sprite.referenceWidth : 1
    const crop = sprite.crop ?? { x: 0, y: 0, width: source.width / ratio, height: source.height / ratio }
    const texture = scene.textures.createCanvas(sprite.key, Math.round(crop.width), Math.round(crop.height))
    if (!texture) throw new Error(`Cannot prepare sprite: ${sprite.key}`)
    // Optional authored silhouettes remove opaque backdrops around irregular props.
    if (sprite.outline) {
      texture.context.beginPath()
      sprite.outline.forEach((point, index) => {
        if (index === 0) texture.context.moveTo(point.x, point.y)
        else texture.context.lineTo(point.x, point.y)
      })
      texture.context.closePath()
      texture.context.clip()
    }
    texture.context.drawImage(source, crop.x * ratio, crop.y * ratio, crop.width * ratio, crop.height * ratio,
      0, 0, crop.width, crop.height)
    texture.refresh()
  }
}
