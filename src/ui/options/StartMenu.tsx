import { useState } from 'react'
import type { AudioController } from '../../app/contracts/audio'
import { OptionsDialog } from './OptionsDialog'
import type { MessageController } from '../../app/contracts/messages'
import type { OptionsController } from '../../app/contracts/save'
import { isModifiedOrComposing } from '../../platform/ui/isModifiedOrComposing.ts'
import { menuKeyboard } from '../components/menuKeyboard'
import { useModalDialog } from '../../platform/ui/useModalDialog'
import { Button } from '../components/Button'
import { GameMessages } from '../components/GameMessages'
import '../components/components.css'
import './start.css'

/**
 * Perform start menu.
 * @param {Function} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function StartMenu({ onNewGame, options, messages, audio }: {
  audio: AudioController
  onNewGame: () => void
  options: OptionsController
  messages: MessageController
}) {
  const [showOptions, setShowOptions] = useState(false)
  const ref = useModalDialog()

  return <dialog ref={ref} className="start-menu" aria-labelledby="start-menu-title"
    onCancel={event => event.preventDefault()} onKeyDown={event => {
      if (isModifiedOrComposing(event)) return

      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowOptions(false)
      }

      menuKeyboard(event, { items: 'button' })
    }}>
    <h1 id="start-menu-title">Main menu</h1>
    <div className="start-menu-actions">
        <Button data-autofocus onClick={onNewGame}>New game</Button>
        <Button onClick={options.load}>Load</Button>
        <Button onClick={() => setShowOptions(true)}>Options</Button>
    </div>
    <GameMessages messages={messages} />
    {showOptions && <OptionsDialog audio={audio} options={options}
      onClose={() => setShowOptions(false)} />}
  </dialog>
}
