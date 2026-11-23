import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { LockpickingController, LockPuzzle } from '../../app/contracts/lockpicking'
import { menuAction } from '../../platform/ui/menuNavigation'
import { rotateLockDigit } from './lockWheelInput'

/**
 * Map menu keys to wheel selection and typed puzzle actions.
 * @param {LockpickingController} lockpicking - Puzzle actions; owns completion rules.
 * @param {LockPuzzle} puzzle - Current wheel values and puzzle lifetime.
 * @returns {object} Selection, wheel focus refs and the keyboard event adapter.
 */
export function useLockpickControls(lockpicking: LockpickingController, puzzle: LockPuzzle) {
  const [selected, setSelected] = useState(0)
  const numbers = useRef<(HTMLButtonElement | null)[]>([])

  /**
   * Handle only recognized menu actions, preventing duplicate native Enter clicks.
   * @param {KeyboardEvent} event - Keyboard input bubbling from the lock controls.
   * @returns {void} Selects, rotates or submits without mutating puzzle state.
   */
  function onKeyDown(event: KeyboardEvent): void {
    const action = menuAction(event)
    if (!action || action === 'first' || action === 'last') return

    event.preventDefault()
    event.stopPropagation()
    if (action === 'choose') {
      if (!event.repeat && !event.nativeEvent.isComposing) lockpicking.submit()
    } else if (action === 'left' || action === 'right') {
      const count = puzzle.numbers.length
      const next = (selected + (action === 'right' ? 1 : count - 1)) % count
      setSelected(next)
      numbers.current[next]?.focus()
    } else {
      lockpicking.setNumber(selected, rotateLockDigit(
        puzzle.numbers[selected], action === 'up' ? -1 : 1,
      ))
    }
  }

  return { selected, setSelected, numbers, onKeyDown }
}
