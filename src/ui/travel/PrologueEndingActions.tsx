import type { KeyboardEvent } from 'react'
import type { OptionsController } from '../../app/contracts/save'
import { CONTENT } from '../../content/catalogue'
import type { StoryConfig } from '../../domain/quests/story'
import { useModalDialog } from '../../platform/ui/useModalDialog'
import { isModifiedOrComposing } from '../../platform/ui/isModifiedOrComposing'
import { menuKeyboard } from '../components/menuKeyboard'
import { Button } from '../components/Button'
import type { MessageController } from '../../app/contracts/messages'
import { GameMessages } from '../components/GameMessages'
import '../death/death.css'

/**
 * Keep arrow and activation keys inside the ending action list.
 * @param {KeyboardEvent<HTMLDialogElement>} event - Key received by the ending modal.
 * @returns {void} Moves focus or activates the selected lifecycle action.
 */
function navigateEndingActions(event: KeyboardEvent<HTMLDialogElement>): void {
  if (isModifiedOrComposing(event)) return

  event.stopPropagation()
  menuKeyboard(event, { items: '.death-screen-actions button', horizontalItems: true })
}

/**
 * Present the persistent destination after leaving the playable quarantine district.
 * @param {object} props - Completed exit route and typed persistence/lifecycle actions.
 * @param {'illegal' | 'official'} props.route - World route used for departure.
 * @param {OptionsController} props.options - Save, load and new-game actions.
 * @param {MessageController} props.messages - Feedback from persistence actions.
 * @returns {import('react').ReactElement} Terminal destination after district gameplay ends.
 */
export function PrologueEndingActions({ route, options, messages }: {
  route: 'illegal' | 'official'
  options: OptionsController
  messages: MessageController
}) {
  const ref = useModalDialog()
  const config = CONTENT.data.story as StoryConfig
  return <dialog ref={ref} className="death-screen" aria-labelledby="ending-title"
    onCancel={event => event.preventDefault()}
    onKeyDown={navigateEndingActions}>
    <h1 id="ending-title">{config.ending[route]}</h1>
    <p>{config.messages.complete}</p>
    <div className="death-screen-actions">
      <Button data-autofocus onClick={options.save}>{config.messages.save}</Button>
      <Button onClick={options.load}>{config.messages.load}</Button>
      <Button onClick={options.restart}>{config.messages.newGame}</Button>
    </div>
    <GameMessages messages={messages} />
  </dialog>
}
