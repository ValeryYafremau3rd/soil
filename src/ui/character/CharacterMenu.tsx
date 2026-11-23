import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { DayTimeController } from '../../app/contracts/daytime'
import type { PerksController } from '../../app/contracts/perks'
import type { Character } from '../../domain/skills/character'
import { menuKeyboard } from '../components/menuKeyboard'
import { PerksMenu } from './PerksMenu'

const tabs = ['Character', 'Effects', 'Perks'] as const

/**
 * Perform character menu.
 * @param {object} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function CharacterMenu({ children, penalties, perks, daytime, skills }: {
  children: ReactNode
  penalties: ReactNode
  perks: PerksController
  daytime: DayTimeController
  skills: Character['skills']
}) {
  const [tab, setTab] = useState<typeof tabs[number]>('Character')
  const prefix = useId()

  return <div className="character-menu" onKeyDownCapture={event => menuKeyboard(event, {
    tabs: '[role="tablist"] button', items: '.perks-journal .quest-names button',
  })}>
    <div className="quest-tabs character-tabs" role="tablist" aria-label="Character sections">
      {tabs.map(name => <button type="button" role="tab" key={name} id={`${prefix}-${name}`}
        aria-selected={tab === name} aria-controls={`${prefix}-panel`} tabIndex={tab === name ? 0 : -1} data-autofocus={tab === name || undefined}
        onClick={() => setTab(name)}>{name}</button>)}
    </div>
    <section className="character-tab-panel" id={`${prefix}-panel`} role="tabpanel" aria-labelledby={`${prefix}-${tab}`} tabIndex={0}>
      {tab === 'Character' ? children : tab === 'Effects'
        ? <PerksMenu key="effects" mode="effects" penalties={penalties} perks={perks} daytime={daytime} skills={skills} />
        : <PerksMenu key="perks" mode="perks" perks={perks} daytime={daytime} skills={skills} />}
    </section>
  </div>
}
