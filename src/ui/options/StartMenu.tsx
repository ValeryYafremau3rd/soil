import type { MessageController } from '../../app/contracts/messages'
import type { OptionsController } from '../../app/contracts/save'
import { isModifiedOrComposing } from '../../platform/ui/isModifiedOrComposing.ts'
import { useModalDialog } from '../../platform/ui/useModalDialog'
import { Button } from '../components/Button'
import { GameMessages } from '../components/GameMessages'
import '../components/components.css'
import './start.css'

export function StartMenu({ onNewGame, options, messages }: {
  onNewGame: () => void; options: Pick<OptionsController, 'load'>; messages: MessageController
}) {
  const ref = useModalDialog()
  return <dialog ref={ref} className="start-menu" aria-labelledby="start-menu-title"
    onCancel={event => event.preventDefault()} onKeyDown={event => {
      if (isModifiedOrComposing(event)) return
      event.stopPropagation()
      if (event.key === 'Escape') event.preventDefault()
      if (event.key === 'Enter') {
        event.preventDefault()
        if (!event.repeat) (event.target as HTMLElement).closest<HTMLButtonElement>('button')?.click()
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
        const current = buttons.indexOf(event.target as HTMLButtonElement)
        buttons[(current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
      }
    }}>
    <h1 id="start-menu-title">Main menu</h1>
    <div className="start-menu-actions">
      <Button data-autofocus onClick={onNewGame}>New game</Button>
      <Button onClick={options.load}>Load</Button>
    </div>
    <GameMessages messages={messages} />
  </dialog>
}
