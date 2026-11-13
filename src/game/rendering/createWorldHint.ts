import type Phaser from 'phaser'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'

export function createWorldHint(scene: Phaser.Scene, x: number, y: number, text: string) {
  const hint = scene.add.text(x, y, text, GAME_SETTINGS.interaction.style)
    .setOrigin(0.5, 1).setDepth(WORLD_LAYERS.hints).setVisible(false)
  registerHint(scene, hint)
  return hint
}

interface HintSelection { hints: Phaser.GameObjects.Text[]; selected?: Phaser.GameObjects.Text }
const selections = new WeakMap<Phaser.Scene, HintSelection>()
function registerHint(scene: Phaser.Scene, hint: Phaser.GameObjects.Text): void {
  let state = selections.get(scene)
  if (!state) {
    state = { hints: [] }
    selections.set(scene, state)
    const layout = () => {
      const options = state!.hints.filter(h => h.active && h.visible && h.text.startsWith('Enter'))
      if (!options.includes(state!.selected!)) state!.selected = options[0]
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
  hint.once('destroy', () => { state!.hints = state!.hints.filter(h => h !== hint) })
}
export function isSelectedHint(hint: Phaser.GameObjects.Text): boolean {
  const state = selections.get(hint.scene)
  return !state?.selected || state.selected === hint
}
export function cycleWorldHint(scene: Phaser.Scene, direction: number): void {
  const state = selections.get(scene)
  const options = state?.hints.filter(h => h.active && h.visible && h.text.startsWith('Enter')) ?? []
  if (!state || options.length < 2) return
  if (direction) state.selected = options[(Math.max(0, options.indexOf(state.selected!)) + direction + options.length) % options.length]
}

export function clearWorldHints(scene: Phaser.Scene): void {
  const state = selections.get(scene)
  if (!state) return
  state.selected = undefined
  for (const hint of state.hints) hint.setVisible(false)
}
