import type Phaser from 'phaser'
import { GAME_SETTINGS } from '../../content/world'
import type { DayPhase } from '../../app/contracts/daytime'

type LightKind = keyof typeof GAME_SETTINGS.lighting.sources
/**
 * World coordinates and interior ownership used to place a scene light.
 */
interface LightPosition {
  x: number
  y: number
  visible: boolean
}
const COLOR_CHANNEL_MAX = 255
const PHASE_EVENT = 'object-light-phase'

/**
 * Set object light phase.
 * @param {Scene} scene - Phaser scene that owns rendering and resources.
 * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function setObjectLightPhase(scene: Phaser.Scene, phase: DayPhase): void {
  scene.events.emit(PHASE_EVENT, phase)
}

/**
 * Point lights add soft radiance to existing art without requiring normal-map assets.
 * @param {Scene} scene - Phaser scene that owns rendering and resources.
 * @param {"entrance" | "corridor" | "room" | "busStop" | "taskboard"} kind - The kind supplied to this operation.
 * @param {() => LightPosition} position - The position supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function createObjectLight(
  scene: Phaser.Scene,
  kind: LightKind,
  position: () => LightPosition
): void {
  const config = GAME_SETTINGS.lighting.sources[kind]
  // Phaser 4's point-light batch passes byte color channels directly into its float shader.
  const light = scene.add.pointlight(
    0,
    0,
    config.color,
    config.radius,
    config.intensity / COLOR_CHANNEL_MAX,
    config.attenuation
  )
    .setDepth(GAME_SETTINGS.lighting.depth).setVisible(false)
  let multiplier = 0
  // Sync after world context changes so hidden props never leave a detached glow.

  /**
   * Perform sync.
   * @returns {void} Completes the operation without returning a value.
   */
  const sync = () => {
    const source = position()
    light.setPosition(source.x, source.y - config.offsetY).setVisible(source.visible && multiplier > 0)
  }

  /**
   * Perform change phase.
   * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const changePhase = (phase: DayPhase) => {
    multiplier = GAME_SETTINGS.lighting.phaseIntensity[phase]
    light.intensity = config.intensity * multiplier / COLOR_CHANNEL_MAX
    sync()
  }
  scene.events.on(PHASE_EVENT, changePhase)
  scene.events.on('postupdate', sync)
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', sync)
    scene.events.off(PHASE_EVENT, changePhase)
  })
}
