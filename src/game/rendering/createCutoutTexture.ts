import Phaser from 'phaser'
import { removeEdgeBackground } from './removeEdgeBackground'

// Supplied art can have an opaque checkerboard. Flood only pale,
// neutral pixels connected to the outer edge; enclosed window panes stay intact.
export function createCutoutTexture(scene: Phaser.Scene, sourceKey: string, key: string, mode: 'none' | 'light' | 'dark' = 'light'): void {
  if (scene.textures.exists(key)) return
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement
  const { width, height } = source
  const texture = scene.textures.createCanvas(key, width, height)
  if (!texture) throw new Error(`Cannot create texture: ${key}`)
  const context = texture.context
  context.drawImage(source, 0, 0)
  const pixels = context.getImageData(0, 0, width, height)
  if (mode !== 'none') removeEdgeBackground(pixels.data, width, height, mode)
  context.putImageData(pixels, 0, 0)
  texture.refresh()
}
