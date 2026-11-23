import { useEffect, useRef } from 'react'

/**
 * Perform use modal dialog.
 * @param {boolean} modal - The modal supplied to this operation.
 * @returns {RefObject<HTMLDialogElement | null>} The result described by the TypeScript return signature.
 */
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
