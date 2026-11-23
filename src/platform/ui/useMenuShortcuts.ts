import { useEffect } from 'react'

/**
 * Perform use menu shortcuts.
 * @param {readonly { id: string; key: string; title: string; }[]} menus - The menus supplied to this operation.
 * @param {(id: string) => void} onOpen - The on open supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function useMenuShortcuts(
  menus: readonly {
    id: string
    key: string
    title: string
  }[],
  onOpen: (id: string) => void
): void {
  useEffect(
    () => {
      /**
       * Perform handle key down.
       * @param {KeyboardEvent} event - The event supplied to this operation.
       * @returns {void} Completes the operation without returning a value.
       */
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return

        if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return

        if (event.key === 'Escape' && document.querySelector('dialog[open]')) return

        const menu = menus.find(item => item.key.toLowerCase() === event.key.toLowerCase())
        if (!menu || document.querySelector('.class-selection[open]')) return

        event.preventDefault()
        event.stopPropagation()
        onOpen(menu.id)
      }
      window.addEventListener('keydown', handleKeyDown, true)

      return () => window.removeEventListener('keydown', handleKeyDown, true)
    },
    [menus, onOpen]
  )
}
