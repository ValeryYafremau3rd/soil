import { useEffect } from 'react'

export function useQuickSlots(onUse: (slot: number) => void, onRelease: () => void): void {
  useEffect(() => {
    let activeCode: string | undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('dialog[open]')) return
      const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)
      if (!match) return
      if (activeCode) return
      event.preventDefault()
      activeCode = event.code
      onUse(Number(match[1]) - 1)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== activeCode) return
      activeCode = undefined
      onRelease()
    }
    const onBlur = () => { activeCode = undefined; onRelease() }
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
  }, [onUse, onRelease])
}
