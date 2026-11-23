import type { AudioController } from '../../app/contracts/audio'
import { useState } from 'react'
import { OptionsDialog } from './OptionsDialog'
import type { OptionsController } from '../../app/contracts/save'
import { menuKeyboard } from '../components/menuKeyboard'
import { Button } from '../components/Button'
import './options.css'

/**
 * Show session actions and open settings in a nested Options dialog.
 * @param {object} props - Session actions and audio settings used by the submenu.
 * @returns {ReactElement} System actions with an optional settings modal.
 */
export function SystemMenu({ options, audio }: {
  options: OptionsController
  audio: AudioController
}) {
  const [showOptions, setShowOptions] = useState(false)

  return <div className="options-menu" onKeyDown={event => menuKeyboard(event, { items: 'button' })}>
    <p>One save slot is stored in this browser.</p>
    <Button data-autofocus onClick={options.save}>Save</Button>
    <Button onClick={options.load}>Load</Button>
    <Button onClick={() => setShowOptions(true)}>Options</Button>
    <Button onClick={options.restart}>Restart</Button>
    <p>Restart returns to character setup. Your saved game is kept.</p>
    <Button onClick={options.exit}>Exit</Button>
    {showOptions && <OptionsDialog audio={audio} options={options}
      onClose={() => setShowOptions(false)} />}
  </div>
}
