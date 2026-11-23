import { useEffect } from 'react'
import type { AudioController } from '../../app/contracts/audio'

/**
 * Perform use quick slots.
 * @param {(slot: number) => void} onUse - The on use supplied to this operation.
 * @param {() => void} onRelease - The on release supplied to this operation.
 * @param {Pick<AudioController, 'cue'>} audio - Shared UI feedback for accepted numeric presses.
 * @returns {void} Completes the operation without returning a value.
 */
export function useQuickSlots(
  onUse: (slot: number) => void,
  onRelease: () => void,
  audio: Pick<AudioController, 'cue'>
): void {
  useEffect(
    () => {
      let activeCode: string | undefined

      /**
       * Perform on key down.
       * @param {KeyboardEvent} event - The event supplied to this operation.
       * @returns {void} Completes the operation without returning a value.
       */
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return

        if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return

        if (document.querySelector('dialog[open]')) return

        const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)
        if (!match) return

        if (activeCode) return

        event.preventDefault()
        activeCode = event.code
        audio.cue('ui')
        onUse(Number(match[1]) - 1)
      }

      /**
       * Perform on key up.
       * @param {KeyboardEvent} event - The event supplied to this operation.
       * @returns {void} Completes the operation without returning a value.
       */
      const onKeyUp = (event: KeyboardEvent) => {
        if (event.code !== activeCode) return

        activeCode = undefined
        onRelease()
      }

      /**
       * Perform on blur.
       * @returns {void} Completes the operation without returning a value.
       */
      const onBlur = () => {
        activeCode = undefined
        onRelease()
      }
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('pointerup', onRelease)
      window.addEventListener('pointercancel', onRelease)
      window.addEventListener('blur', onBlur)

      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        window.removeEventListener('pointerup', onRelease)
        window.removeEventListener('pointercancel', onRelease)
        window.removeEventListener('blur', onBlur)
        onRelease()
      }
    },
    [onUse, onRelease, audio]
  )
}
