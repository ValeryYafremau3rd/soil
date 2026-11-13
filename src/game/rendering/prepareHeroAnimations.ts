import Phaser from 'phaser'
import {
HERO_ACTION,HERO_ANIMATIONS,HERO_ANIMATION_STEPS,HERO_ASSET,
HERO_MATTE,
HERO_SETTINGS,
heroFrameKey,
} from '../../content/hero'
import { keepLargestComponent } from '../rendering/keepLargestComponent'
import { removeEdgeBackground } from '../rendering/removeEdgeBackground'
export function prepareHeroAnimations(scene: Phaser.Scene): void {
    prepareHeroFrames(scene)
    for (const action of Object.values(HERO_ACTION)) {
      if (scene.anims.exists(action)) continue
      const steps = HERO_ANIMATION_STEPS[action]
      scene.anims.create({
        key: action,
        frames: steps.map((_, index) => ({ key: heroFrameKey(action, index) })),
        ...HERO_ANIMATIONS[action],
      })
    }

}

function prepareHeroFrames(scene: Phaser.Scene): void {
    const source = scene.textures.get(HERO_ASSET.key).getSourceImage() as HTMLImageElement
    const ratio = source.width / HERO_ASSET.referenceWidth
    const { frameWidth, frameHeight } = HERO_SETTINGS
    const regions = Object.values(HERO_ACTION).flatMap(action =>
      HERO_ANIMATION_STEPS[action].map((step, index) => ({ ...step, key: heroFrameKey(action, index) })))
    for (const region of regions) {
      if (scene.textures.exists(region.key)) continue
      const texture = scene.textures.createCanvas(region.key, frameWidth, frameHeight)
      if (!texture) continue
      const context = texture.context
      const scale = region.scale ?? 1
      context.drawImage(source,
        Math.round(region.x * ratio), Math.round(region.y * ratio),
        Math.round(region.width * ratio), Math.round(region.height * ratio),
        frameWidth / 2 - (region.anchorX ?? region.width / 2) * scale,
        frameHeight - (region.anchorY ?? region.height) * scale, region.width * scale, region.height * scale)
      for (const excluded of region.excludeRegions ?? []) {
        context.clearRect(
          frameWidth / 2 - (region.anchorX ?? region.width / 2) * scale + excluded.x * scale,
          frameHeight - (region.anchorY ?? region.height) * scale + excluded.y * scale,
          excluded.width * scale, excluded.height * scale)
      }
      // The backdrop is blue-grey; the hero has warm brown shadows. Brightness
      // alone also matches his clothes and punches holes through the sprite.
      const pixels = context.getImageData(0, 0, frameWidth, frameHeight)
      removeEdgeBackground(pixels.data, frameWidth, frameHeight, (red, green, blue) =>
        red <= HERO_MATTE.redMax && green <= HERO_MATTE.greenMax && blue <= HERO_MATTE.blueMax
        && green - red >= HERO_MATTE.minGreenRed && blue - red >= HERO_MATTE.minBlueRed)
      if (region.keepLargestComponent) keepLargestComponent(pixels.data, frameWidth, frameHeight)
      context.putImageData(pixels, 0, 0)
      texture.refresh()
    }
  }
