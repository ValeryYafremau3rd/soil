import type { AudioController } from '../../app/contracts/audio'
import {
  soundMenuActivation, soundMenuNavigation, soundMenuSelection, soundMenuWheel,
} from './menuSoundEvents.ts'

/**
 * Bind shared UI feedback before modal listeners consume mouse and keyboard input.
 * @param {Window} target - Window that owns the menus and lifecycle listeners.
 * @param {Pick<AudioController, 'cue'>} audio - Narrow service playback capability.
 * @returns {() => void} Releases every input listener and wheel observer on teardown.
 */
export function bindMenuSounds(
  target: Window,
  audio: Pick<AudioController, 'cue'>,
): () => void {
  const listeners: [string, EventListener][] = [
    ['click', event => soundMenuActivation(event, audio)],
    ['change', event => soundMenuActivation(event, audio)],
    ['keydown', event => soundMenuNavigation(event as KeyboardEvent, target.document, audio)],
    ['mouseover', event => soundMenuSelection(event as MouseEvent, audio)],
  ]
  const observer = new MutationObserver(records => soundMenuWheel(records, audio))
  observer.observe(target.document, {
    subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['aria-valuenow'],
  })
  for (const [name, listener] of listeners) target.addEventListener(name, listener, true)

  return () => {
    for (const [name, listener] of listeners) target.removeEventListener(name, listener, true)
    observer.disconnect()
  }
}
