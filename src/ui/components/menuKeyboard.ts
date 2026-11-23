import type { KeyboardEvent } from 'react'
import { menuAction } from '../../platform/ui/menuNavigation.ts'
import { selectionIndex } from './selection.ts'

/**
 * Tabs own horizontal movement; lists own vertical movement, including nested groups.
 * @param {KeyboardEvent<HTMLElement>} event - The event supplied to this operation.
 * @param {Function} options - The options supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function menuKeyboard(
  event: KeyboardEvent<HTMLElement>,
  options: {
    tabs?: string
    items?: string
    wrap?: boolean
    horizontalItems?: boolean
    choose?: () => void
  } = {}
): void {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return

  const action = menuAction(event)
  if (!action) return

  const root = event.currentTarget
  if (action === 'choose') {
    // Preserve links and native controls outside the menu's button lists.
    if (target.closest('a')) return

    const button = target.closest<HTMLButtonElement>('button')
    if (button?.disabled) return

    if (!options.choose && !button) return

    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) {
      if (options.choose) options.choose(); else button?.click()
    }

    return
  }

  const horizontal = action === 'left' || action === 'right'
  const tabEdge = (action === 'first' || action === 'last') && target.closest('[role="tab"]')
  const tabs = Boolean(options.tabs && (horizontal || tabEdge))
  if (horizontal && !tabs && !options.horizontalItems) return

  const selector = tabs ? options.tabs : options.items
  if (!selector) return

  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(selector))
    .filter(button => !button.disabled && !button.closest('[hidden]'))
  if (!buttons.length) return

  const current = tabs ? buttons.findIndex(button => button.getAttribute('aria-selected') === 'true')
    : buttons.indexOf(root.ownerDocument.activeElement as HTMLButtonElement)
  const next = selectionIndex(current, buttons.length, action, tabs || (options.wrap ?? true))
  event.preventDefault()
  event.stopPropagation()
  if (tabs) buttons[next].click()

  buttons[next].focus()
  buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
