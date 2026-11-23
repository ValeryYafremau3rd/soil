import type { AudioController } from '../../app/contracts/audio'
import type { OptionsController } from '../../app/contracts/save'
import { useModalDialog } from '../../platform/ui/useModalDialog'
import { Button } from '../components/Button'
import { menuKeyboard } from '../components/menuKeyboard'
import { DifficultyControl } from './DifficultyControl'
import { SoundToggle } from './SoundToggle'
import '../components/components.css'
import '../components/dossier.css'
import './options.css'

/**
 * Present paper-styled settings above the parent menu with focus capture and restoration.
 * @param {object} props - Audio, session settings and the close action.
 * @returns {ReactElement} Modal sound and difficulty controls.
 */
export function OptionsDialog({ audio, options, onClose }: {
  audio: AudioController
  options: OptionsController
  onClose: () => void
}) {
  const ref = useModalDialog()

  /**
   * Restore the parent menu's focus before React removes the dialog.
   * @returns {void} Closes the native modal and updates its owner's visibility.
   */
  function close() {
    ref.current?.close()
    onClose()
  }

  return <dialog ref={ref} className="ui-modal dossier-modal options-dialog" aria-label="Options"
    onCancel={event => { event.preventDefault(); close() }}
    onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
      menuKeyboard(event, { items: 'button, select' })
    }}>
    <section className="ui-panel">
      <header className="ui-modal__header">
        <h2>Options</h2>
        <button type="button" className="dossier-close" aria-label="Close Options"
          onClick={close}>×</button>
      </header>
      <div className="options-menu">
        <SoundToggle audio={audio} />
        <DifficultyControl options={options} />
        <Button onClick={close}>Back</Button>
      </div>
    </section>
  </dialog>
}
