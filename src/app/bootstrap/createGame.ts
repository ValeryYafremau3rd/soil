
import Phaser from 'phaser'
import { GameplayScene } from '../../game/scenes/GameplayScene'
import type { GameServices } from '../contracts/game'
import { GAME_SETTINGS } from '../../content/world'

/**
 * Create game.
 * @param {HTMLElement} parent - The parent supplied to this operation.
 * @param {GameServices} services - The services supplied to this operation.
 * @param {(() => void) | undefined} onReady - The on ready supplied to this operation.
 * @param {(() => void) | undefined} onDeathComplete - The on death complete supplied to this operation.
 * @returns {Game} The result described by the TypeScript return signature.
 */
export function createGame(
  parent: HTMLElement,
  services: GameServices,
  onReady?: () => void,
  onDeathComplete?: () => void
): Phaser.Game {
  const config = GAME_SETTINGS.scene

  return new Phaser.Game({
    type: Phaser.AUTO, parent, backgroundColor: config.backgroundColor,
    // Expand the visible world to the window's aspect ratio without stretching sprites.
    scale: { mode: Phaser.Scale.EXPAND, width: config.width, height: config.height },
    scene: [new GameplayScene(services, onReady, onDeathComplete)],
  })
}
