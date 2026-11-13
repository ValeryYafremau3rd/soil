import { useRef, useState } from 'react'
import { DIFFICULTIES, difficultyRules } from '../../content/difficulty'
import { CLASSES } from '../../content/classes'
import { VITAL_LABELS } from '../../domain/inventory/items'
import { useModalDialog } from '../../platform/ui/useModalDialog'
import { Button } from '../components/Button'
import { createCharacter } from '../../domain/skills/character'
import { activeBonusItems, applyCarriedBonuses } from '../../domain/inventory/items'
import { ITEM_BY_ID } from '../../content/items'
import { SKILL_EFFECT_CONFIG } from '../../content/skills'
import { resolveSkillEffects } from '../../domain/skills/effects'
import { scaleRecovery } from '../../domain/character/difficulty'
import { attributeVitals } from '../../domain/skills/vitals'
import { conditionedCharacter } from '../../domain/skills/condition'
import '../components/components.css'
import './difficulty.css'

export function DifficultySelection({ classId, onSelect, onBack }: {
  classId: string; onSelect: (difficultyId: string) => void; onBack: () => void
}) {
  const [difficultyId, setDifficultyId] = useState(DIFFICULTIES.defaultId)
  const ref = useModalDialog()
  const submitted = useRef(false)
  const rules = difficultyRules(difficultyId)
  const definition = CLASSES.find(entry => entry.id === classId)!
  const className = definition.name
  const bonuses = activeBonusItems(definition.startingItems.map(itemId => ({ itemId, quantity: definition.startingItemQuantities?.[itemId] ?? 1 })), {}, ITEM_BY_ID)
  const character = applyCarriedBonuses(createCharacter(definition), bonuses, ITEM_BY_ID)
  const stats = attributeVitals(rules.stats, character.attributes)
  const initial = (id: 'energy' | 'sanity') => Math.min(stats.find(stat => stat.id === id)!.value, stats.find(stat => stat.id === id)!.max)
  const effective = conditionedCharacter(createCharacter(definition), bonuses, ITEM_BY_ID,
    { energy: initial('energy'), sanity: initial('sanity') },
    { energy: stats.find(stat => stat.id === 'energy')!.max, sanity: stats.find(stat => stat.id === 'sanity')!.max })
  const effects = resolveSkillEffects(effective.skills, SKILL_EFFECT_CONFIG)
  return <dialog ref={ref} className="difficulty-selection" aria-labelledby="difficulty-title"
    onCancel={event => event.preventDefault()}
    onKeyDown={event => { if (event.key === 'Escape') event.preventDefault() }}
    onKeyDownCapture={event => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey) return
      if (event.target instanceof HTMLElement && event.target.closest('button[type="button"]')) return
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) ref.current?.querySelector('form')?.requestSubmit()
    }}>
    <form onSubmit={event => {
      event.preventDefault()
      if (submitted.current) return
      submitted.current = true
      onSelect(difficultyId)
    }}>
      <header><h1 id="difficulty-title">Choose difficulty</h1><p>{className} · Select the challenge for your new character.</p></header>
      <fieldset>
        <legend>Difficulty</legend>
        <div className="difficulty-options">
          {DIFFICULTIES.presets.map(preset => <label key={preset.id} className={difficultyId === preset.id ? 'is-selected' : ''}>
            <span><input type="radio" name="difficulty" value={preset.id} checked={difficultyId === preset.id}
              data-autofocus={difficultyId === preset.id ? true : undefined} onChange={() => setDifficultyId(preset.id)} /> <strong>{preset.name}</strong></span>
            <small>{preset.description}</small>
          </label>)}
        </div>
      </fieldset>
      <div className="difficulty-preview" aria-live="polite">
        <p>Starting: {stats.map(stat => `${stat.value} ${VITAL_LABELS[stat.id]}`).join(' · ')}</p>
        <p>Maximum: {stats.map(stat => `${stat.max} ${VITAL_LABELS[stat.id]}`).join(' · ')}</p>
        <p>Melee {Math.round(rules.hero.meleeDamage * effects.meleeDamage)} · Shooting {Math.round(rules.hero.shotDamage * effects.rangedDamage)}</p>
        <p>Rest +{scaleRecovery(rules.recovery.rest, effects.recovery).health} Health · Sleep +{scaleRecovery(rules.recovery.sleep, effects.recovery).health} Health</p>
      </div>
      <footer><Button variant="secondary" onClick={onBack}>Back to classes</Button><Button type="submit">Start game</Button></footer>
    </form>
  </dialog>
}
