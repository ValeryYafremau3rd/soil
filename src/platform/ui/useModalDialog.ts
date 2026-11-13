import { useEffect, useRef } from 'react'

export function useModalDialog(modal = true) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (modal) dialog?.showModal()
    else dialog?.show()
    if (!modal) dialog?.querySelector<HTMLElement>('button')?.focus()
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => dialog?.close()
  }, [modal])
  return ref
}
