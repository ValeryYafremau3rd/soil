import { useId } from 'react'
import type { ReactNode } from 'react'
import { useModalDialog } from '../../platform/ui/useModalDialog'
import './components.css'
import './dossier.css'
import './documentDetails.css'

/**
 * Perform modal.
 * @param {{ title: string onClose: () => void children: ReactNode className?: string hideHeader?: boolean }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function Modal({ title, onClose, children, className = '', hideHeader = false,
  afterTitle }: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  hideHeader?: boolean
  afterTitle?: ReactNode
}) {
  // Session state captures player controls while the world continues running.
  const ref = useModalDialog(false)
  const titleId = useId()
  const dossier = className.split(' ').includes('dossier-modal')

  return <div className="ui-modal-backdrop" onClick={event => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <dialog ref={ref} className={`ui-modal ${className}`} aria-labelledby={hideHeader ? undefined : titleId} aria-label={hideHeader ? title : undefined}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <section className="ui-panel">
        {!hideHeader && <header className="ui-modal__header">
          <h2 id={titleId}>{title}{afterTitle}</h2>
          {dossier && <button type="button" className="dossier-close" aria-label={`Close ${title}`} onClick={onClose}>×</button>}
        </header>}
        {children}
      </section>
    </dialog></div>
}
