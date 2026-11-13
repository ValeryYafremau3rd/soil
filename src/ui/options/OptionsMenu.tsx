import type { OptionsController } from '../../app/contracts/save'
import { isModifiedOrComposing } from '../../platform/ui/isModifiedOrComposing.ts'
import { Button } from '../components/Button'
import './options.css'

export function OptionsMenu({ options }: { options: OptionsController }) {
  return <div className="options-menu" onKeyDown={event => {
    if (isModifiedOrComposing(event)) return
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) (event.target as HTMLElement).closest<HTMLButtonElement>('button')?.click()
      return
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    event.stopPropagation()
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const index = buttons.indexOf(event.target as HTMLButtonElement)
    buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
  }}>
    <p>One save slot is stored in this browser.</p>
    <Button data-autofocus onClick={options.save}>Save</Button>
    <Button onClick={options.load}>Load</Button>
    <Button onClick={options.restart}>Restart</Button>
    <p>Restart returns to character setup. Your saved game is kept.</p>
    <Button onClick={options.exit}>Exit</Button>
  </div>
}
