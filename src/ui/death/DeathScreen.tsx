import type { MessageController } from '../../app/contracts/messages'
import { isModifiedOrComposing } from '../../platform/ui/isModifiedOrComposing.ts'
import { useModalDialog } from '../../platform/ui/useModalDialog'
import { Button } from '../components/Button'
import '../components/components.css'
import { GameMessages } from '../components/GameMessages'
import './death.css'

export function DeathScreen({ onNewGame, onLastSave, messages }: {
  onNewGame: () => void; onLastSave: () => void; messages: MessageController
}) {
  const ref = useModalDialog()
  return <dialog ref={ref} className="death-screen" aria-labelledby="death-screen-title"
    onCancel={event => event.preventDefault()}
    onKeyDown={event => {
      if (isModifiedOrComposing(event)) return
      event.stopPropagation()
      if (event.key === 'Escape') event.preventDefault()
      if (event.key === 'Enter') {
        event.preventDefault()
        if (!event.repeat) (event.target as HTMLElement).closest<HTMLButtonElement>('button')?.click()
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault()
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.death-screen-actions button:not(:disabled)')]
        const current = buttons.indexOf(event.target as HTMLButtonElement)
        const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
        const next = current < 0 ? 0 : (current + direction + buttons.length) % buttons.length
        buttons[next]?.focus()
      }
    }}>
    <h1 id="death-screen-title">You are dead</h1>
    <div className="death-screen-actions">
      <Button data-autofocus onClick={onLastSave}>Last save</Button>
      <Button variant="secondary" onClick={onNewGame}>New game</Button>
    </div>
    <GameMessages messages={messages} />
  </dialog>
}
