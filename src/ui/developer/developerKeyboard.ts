import type { KeyboardEvent } from 'react'
import { menuKeyboard } from '../components/menuKeyboard'

/**
 * Perform developer keyboard.
 * @param {KeyboardEvent<HTMLDivElement>} event - The event supplied to this operation.
 * @param {() => void} act - The act supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function developerKeyboard(
  event: KeyboardEvent<HTMLDivElement>,
  act: () => void
): void {
  const target = event.target as HTMLElement
  const group = target.closest<HTMLButtonElement>('.notes-group')
  menuKeyboard(
    event,
    {
      tabs: '.notes-tabs button',
      items: '.notes-entries button',
      wrap: false,
      choose: target.closest('.notes-entries') ? () => {
        if (group) group.click(); else act()
      } : undefined,
    }
  )
}
