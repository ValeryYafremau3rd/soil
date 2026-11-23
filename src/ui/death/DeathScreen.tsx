import type { MessageController } from '../../app/contracts/messages'
import { isModifiedOrComposing } from '../../platform/ui/isModifiedOrComposing.ts'
import { menuKeyboard } from '../components/menuKeyboard'
import { useModalDialog } from '../../platform/ui/useModalDialog'
import { Button } from '../components/Button'
import '../components/components.css'
import { GameMessages } from '../components/GameMessages'
import './death.css'

/**
 * Perform death screen.
 * @param {{ onNewGame: () => void onLastSave: () => void messages: MessageController }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function DeathScreen({ onNewGame, onLastSave, messages }: {
  onNewGame: () => void
  onLastSave: () => void
  messages: MessageController
}) {
  const ref = useModalDialog()

  return <dialog ref={ref} className="death-screen" aria-labelledby="death-screen-title"
    onCancel={event => event.preventDefault()}
    onKeyDown={event => {
      if (isModifiedOrComposing(event)) return

      event.stopPropagation()
      if (event.key === 'Escape') event.preventDefault()

      menuKeyboard(event, { items: '.death-screen-actions button', horizontalItems: true })
    }}>
    <h1 id="death-screen-title">You are dead</h1>
    <div className="death-screen-actions">
      <Button data-autofocus onClick={onLastSave}>Last save</Button>
      <Button variant="secondary" onClick={onNewGame}>New game</Button>
    </div>
    <GameMessages messages={messages} />
  </dialog>
}
