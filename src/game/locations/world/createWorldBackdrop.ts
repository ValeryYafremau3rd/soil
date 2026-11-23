import type Phaser from 'phaser'
import type { TravelLocation } from '../../../app/contracts/travel'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../../content/world'

/**
 * Configure authored background parallax and camera limits without moving the ground plane.
 * @param {Phaser.Scene} scene - Scene that owns background and camera resources.
 * @param {TravelLocation} location - Authored background dimensions and ground alignment.
 * @returns {object} Background display width, ground coordinate and scaled image height.
 */
export function createWorldBackdrop(scene: Phaser.Scene, location: TravelLocation) {
  const background = scene.add.image(0, 0, location.background.key).setOrigin(0).setDepth(WORLD_LAYERS.background)
  const height = location.background.height * (location.background.scale ?? 1)
  background.setScale(height / background.height)
  // Slow horizontal scenery while retaining vertical ground alignment during jumps/stairs.
  background.setScrollFactor(location.background.scrollFactor ?? 1, 1)
  const width = background.displayWidth
  const groundY = height * location.background.groundRatio
  // Crop excess pavement below the ground instead of moving sprites off their authored floor.
  const bottomMargin = scene.cameras.main.height * (1 - GAME_SETTINGS.scene.groundScreenRatio)
  scene.cameras.main.setBounds(0, 0, width, Math.min(height, groundY + bottomMargin))
  return { width, groundY, height }
}
