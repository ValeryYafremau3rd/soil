import Phaser from 'phaser'
import { BootScene } from '../../game/scenes/BootScene'
import type { GameServices } from '../contracts/game'
import { GAME_SETTINGS } from '../../content/world'

export function createGame(parent: HTMLElement, services: GameServices, onReady?: () => void, onDeathComplete?: () => void): Phaser.Game {
  const config = GAME_SETTINGS.scene
  return new Phaser.Game({
    type: Phaser.AUTO, parent, backgroundColor: config.backgroundColor,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, width: config.width, height: config.height },
    scene: [new BootScene(services, onReady, onDeathComplete)],
  })
}
