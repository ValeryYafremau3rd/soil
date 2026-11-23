import { useState } from 'react'
import type { OptionsController } from '../../app/contracts/save'
import { DIFFICULTIES } from '../../content/difficulty'
import { Button } from '../components/Button'

/**
 * Preview a challenge selection and apply it only through an explicit action.
 * @param {object} props - Options service that owns the selected difficulty.
 * @returns {ReactElement} Difficulty selector and an explicit apply button.
 */
export function DifficultyControl({ options }: {
  options: Pick<OptionsController, 'getDifficulty' | 'changeDifficulty'>
}) {
  const [selected, setSelected] = useState(options.getDifficulty)

  return <>
    <label>
      Difficulty{' '}
      <select value={selected} onChange={event => setSelected(event.target.value)}>
        {DIFFICULTIES.presets.map(preset =>
          <option key={preset.id} value={preset.id}>{preset.name}</option>)}
      </select>
    </label>
    <Button disabled={selected === options.getDifficulty()}
      onClick={() => options.changeDifficulty(selected)}>Apply difficulty</Button>
  </>
}
