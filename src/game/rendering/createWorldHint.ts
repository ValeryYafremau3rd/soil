import type Phaser from 'phaser'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'

/**
 * Create world hint.
 * @param {Scene} scene - Phaser scene that owns rendering and resources.
 * @param {number} x - Horizontal coordinate.
 * @param {number} y - Vertical coordinate.
 * @param {string} text - The text supplied to this operation.
 * @returns {Text} The result described by the TypeScript return signature.
 */
export function createWorldHint(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string
) {
  const hint = scene.add.text(x, y, text, GAME_SETTINGS.interaction.style)
    .setOrigin(0.5, 1).setDepth(WORLD_LAYERS.hints).setVisible(false)
  registerHint(scene, hint)

  return hint
}

/**
 * Resolved interaction target and hint text for the current hero context.
 */
interface HintSelection {
  hints: Phaser.GameObjects.Text[]
  direction?: number
  selected?: Phaser.GameObjects.Text
}
const selections = new WeakMap<Phaser.Scene, HintSelection>()

/**
 * Perform register hint.
 * @param {Scene} scene - Phaser scene that owns rendering and resources.
 * @param {Text} hint - The hint supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
function registerHint(
  scene: Phaser.Scene,
  hint: Phaser.GameObjects.Text
): void {
  let state = selections.get(scene)
  if (!state) {
    state = { hints: [] }
    selections.set(scene, state)

    /**
     * Perform layout.
     * @returns {void} Completes the operation without returning a value.
     */
    const layout = () => {
      const options = state!.hints.filter(h => h.active && h.visible && h.text.startsWith('Enter'))
      if (!options.includes(state!.selected!)) state!.selected = options[0]
      if (options.length && state!.direction) {
        const index = options.indexOf(state!.selected!)
        state!.selected = options[(index + state!.direction + options.length) % options.length]
      }
      state!.direction = 0

      if (!options.length) return

      const x = options[0].x, y = Math.min(...options.map(h => h.y))
      let offset = -options.reduce((height, option) => height + option.height + 4, -4)

      for (const option of options) {
        option.setPosition(x, y + offset + option.height).setBackgroundColor(option === state!.selected ? '#70551a' : '#151515')
        offset += option.height + 4
      }

      const top = Math.min(...options.map(option => option.getBounds().top))

      for (const hint of state!.hints) {
        if (!hint.active || !hint.visible || options.includes(hint)) continue

        const bounds = hint.getBounds()
        const overlaps = options.some(option => {
          const optionBounds = option.getBounds()

          return bounds.left < optionBounds.right && bounds.right > optionBounds.left
            && bounds.top < optionBounds.bottom && bounds.bottom > optionBounds.top - GAME_SETTINGS.interaction.hintGap
        })
        if (overlaps) hint.setY(top - GAME_SETTINGS.interaction.hintGap)
      }
    }
    scene.events.on('postupdate', layout)
    scene.events.once('shutdown', () => {
      scene.events.off('postupdate', layout)
      selections.delete(scene)
    })
  }

  state.hints.push(hint)
  hint.once('destroy', () => {
    state!.hints = state!.hints.filter(h => h !== hint)
  })
}

/**
 * Check whether selected hint is true.
 * @param {Text} hint - The hint supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function isSelectedHint(hint: Phaser.GameObjects.Text): boolean {
  const state = selections.get(hint.scene)

  return !state?.selected || state.selected === hint
}

/**
 * Queue selection until all nearby prompts have reported their current-frame visibility.
 * @param {Scene} scene - Phaser scene that owns rendering and resources.
 * @param {number} direction - Negative selects the previous action; positive selects the next.
 * @returns {void} Resolves selection during the shared post-update layout.
 */
export function cycleWorldHint(
  scene: Phaser.Scene,
  direction: number
): void {
  const state = selections.get(scene)
  if (state && direction) state.direction = Math.sign(direction)
}

/**
 * Clear world hints.
 * @param {Scene} scene - Phaser scene that owns rendering and resources.
 * @returns {void} Completes the operation without returning a value.
 */
export function clearWorldHints(scene: Phaser.Scene): void {
  const state = selections.get(scene)
  if (!state) return

  state.selected = undefined
  state.direction = 0

  for (const hint of state.hints) hint.setVisible(false)
}
