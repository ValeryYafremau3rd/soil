import { useId, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { DayTimeController } from '../../app/contracts/daytime'
import { DAY_PHASES } from '../../app/contracts/daytime'
import type { PerksController } from '../../app/contracts/perks'
import { ITEM_BY_ID } from '../../content/items'
import config from '../../content/skills.json'
import { VITAL_LABELS } from '../../domain/inventory/items'
import type { Character } from '../../domain/skills/character'
import { ATTRIBUTE_LABELS, SKILL_LABELS } from '../../domain/skills/character'
import { itemBuffMultiplier, legendarySkill, scaleItemBuff } from '../../domain/skills/effects'
import { menuKeyboard } from '../components/menuKeyboard'
import '../quests/quests.css'
import './perks.css'

/**
 * Perform signed.
 * @param {number} value - The value supplied to this operation.
 * @returns {string} The resolved text value.
 */
const signed = (value: number): string => value > 0 ? `+${value}` : String(value)

/**
 * Perform perks menu.
 * @param {object} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function PerksMenu({ perks, daytime, emptyMessage, mode, penalties, skills = {} }: {
  mode: 'effects' | 'perks'
  penalties?: ReactNode
  skills?: Partial<Character['skills']>
  perks: PerksController
  daytime: DayTimeController
  emptyMessage?: string
}) {
  const state = useSyncExternalStore(perks.subscribe, perks.getSnapshot)
  const time = useSyncExternalStore(daytime.subscribe, daytime.getSnapshot)
  const tick = (time.day - 1) * DAY_PHASES.length + DAY_PHASES.indexOf(time.phase)
  const [selectedId, setSelectedId] = useState(mode === 'effects' ? 'condition' : '')
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(new Set())
  const prefix = useId()
  const entries = [
    ...perks.definitions.filter(perk => state.acquired.includes(perk.id)).map(perk => ({ ...perk, kind: 'addiction' as const })),
    ...perks.buffDefinitions.filter(buff => state.buffs?.some(active => active.id === buff.id)
      && !(legendarySkill(skills, 'medicine') && buff.amount < 0 && buff.itemIds.some(id => (['Medical', 'Drink', 'Food'].includes(ITEM_BY_ID[id]?.category) || id.endsWith('-cigarettes')))))
      .map(buff => ({
        ...buff,
        amount: scaleItemBuff(buff.amount, itemBuffMultiplier(skills)),
        kind: 'buff' as const
      })),
    ...config.legendary.perks.filter(perk => legendarySkill(skills, perk.skill as keyof Character['skills'])).map(perk => ({
      ...perk,
      id: 'legendary-' + perk.skill,
      name: 'Legendary ' + SKILL_LABELS[perk.skill as keyof Character['skills']],
      kind: 'legendary' as const
    }))
  ].filter(entry => mode === 'effects' ? entry.kind === 'buff' : entry.kind !== 'buff')
  const selected = entries.find(perk => perk.id === selectedId) ?? entries[0]
  const conditionSelected = mode === 'effects' && selectedId === 'condition'

  /**
   * Perform entry name.
   * @param {object} entry - The entry supplied to this operation.
   * @returns {string} The resolved text value.
   */
  const entryName = (entry: typeof entries[number]) => entry.kind === 'buff'
    ? `${entry.name} (${entry.itemIds.map(id => ITEM_BY_ID[id].name).join(', ')})` : entry.name
  const groups = [
    { name: 'Skill perks', entries: entries.filter(entry => entry.kind === 'legendary') },
    { name: 'Permanent perks', entries: entries.filter(entry => entry.kind === 'addiction') },
    { name: 'Temporary effects', entries: entries.filter(entry => entry.kind === 'buff') },
  ].filter(group => group.entries.length > 0)

  return <div className="perks-journal" onKeyDownCapture={event => menuKeyboard(event, { items: '.quest-names button' })}>
    <div className="quest-layout">
      <nav className="quest-names" aria-label={mode === 'effects' ? 'Effects' : 'Perks'}>
        {mode === 'effects' && <>
          <button type="button" aria-pressed={conditionSelected} aria-current={conditionSelected ? 'true' : undefined}
            aria-controls={`${prefix}-details`} onClick={() => setSelectedId('condition')} onFocus={() => setSelectedId('condition')}>Condition effects</button>
          {entries.map(entry => <button type="button" key={entry.id}
            aria-pressed={!conditionSelected && selected?.id === entry.id} aria-current={!conditionSelected && selected?.id === entry.id ? 'true' : undefined}
            aria-controls={`${prefix}-details`} onClick={() => setSelectedId(entry.id)} onFocus={() => setSelectedId(entry.id)}>{entryName(entry)}</button>)}
        </>}
        {entries.length === 0 && <p className="perks-empty">{emptyMessage ?? (mode === 'effects' ? 'No active temporary effects.' : 'No perks acquired yet.')}</p>}
        {mode === 'perks' && groups.map((
          group,
          index
        ) => <div className="perks-group-section" key={group.name}>
            <button type="button" className="perks-group" aria-expanded={expandedGroups.has(group.name)}
              aria-controls={`${prefix}-group-${index}`} data-autofocus={index === 0 || undefined}
              onClick={() => setExpandedGroups(current => {
                const next = new Set(current)
                if (next.has(group.name)) next.delete(group.name); else next.add(group.name)

                return next
              })}>{expandedGroups.has(group.name) ? '▾' : '▸'} {group.name} ({group.entries.length})</button>
            <div id={`${prefix}-group-${index}`} className="perks-group-items" hidden={!expandedGroups.has(group.name)}>
              {expandedGroups.has(group.name) && group.entries.map(perk => <button key={perk.id} type="button" id={`${prefix}-${perk.id}`}
                aria-pressed={selected?.id === perk.id} aria-current={selected?.id === perk.id ? 'true' : undefined}
                aria-controls={`${prefix}-details`} tabIndex={selected?.id === perk.id ? 0 : -1}
                onClick={() => setSelectedId(perk.id)} onFocus={() => setSelectedId(perk.id)}>{perk.name}</button>)}
            </div>
          </div>)}
      </nav>
      <section className="quest-details perks-details" id={`${prefix}-details`} aria-label={mode === 'effects' ? 'Effect details' : 'Perk details'}>
        {conditionSelected ? <><h3>Condition effects</h3><p>Low Energy reduces attributes. Low Sanity reduces skills. Current penalties are listed below.</p>{penalties}</> : !selected ? <><h3>{mode === 'effects' ? 'Effect details' : 'Perk details'}</h3><p>{mode === 'effects' ? 'Active food, medicine, alcohol and other temporary effects appear here.' : 'Permanent traits and perks granted by your current skills appear here.'}</p></> : <>
          <p className="perks-label">{selected.kind === 'legendary' ? 'Legendary perk' : selected.kind === 'buff' ? 'Temporary buff' : 'Acquired trait'}</p>
          <h3>{entryName(selected)}</h3>
          {selected.kind === 'legendary' ? <section className="perks-effect perks-effect--benefit" aria-label="Positive effect">
            <h4>Positive effect</h4>
            <p>{selected.description}</p>
          </section> : <p>{selected.description}</p>}
          {selected.kind === 'legendary' ? <p>Active at {config.legendary.threshold}+ {SKILL_LABELS[selected.skill as keyof Character['skills']]}.</p> : selected.kind === 'addiction' && selected.actionPoints ? <div className="perks-effects">
            {[true, false].map(positive => <section key={String(positive)}
              className={`perks-effect perks-effect--${positive ? 'benefit' : 'cost'}`}
              aria-label={positive ? 'Positive bonuses' : 'Negative bonuses'}>
              <h4>{positive ? 'Positive bonuses' : 'Negative bonuses'}</h4>
              <dl>{Object.entries(selected.skillModifiers ?? {}).filter(([, amount]) => positive ? amount > 0 : amount < 0)
                .map(([skill, amount]) => <div key={skill}><dt>{SKILL_LABELS[skill as keyof typeof SKILL_LABELS]}</dt><dd>{signed(amount)}</dd></div>)}
                {Object.entries(selected.chargeDamage ?? {}).filter(([, amount]) => positive ? amount > 0 : amount < 0)
                  .map(([endpoint, amount]) => <div key={endpoint}><dt>{endpoint === 'start' ? 'Starting damage' : 'Full-charge damage'}</dt><dd>{signed(amount)}x</dd></div>)}
              </dl>
            </section>)}
          </div> : selected.kind === 'buff' ? <section className={`perks-effect perks-effect--${selected.amount > 0 ? 'benefit' : 'cost'}`} aria-label="Temporary effect">
            <h4>Active effect</h4>
            <dl>
              <div><dt>{selected.attribute ? ATTRIBUTE_LABELS[selected.attribute] : selected.skill ? SKILL_LABELS[selected.skill] : selected.damageResistance ? "Damage resistance (%)" : selected.fearResistance ? "Fear resistance (%)" : `Maximum ${VITAL_LABELS[selected.vital!]}`}</dt><dd>{signed(selected.amount)}</dd></div>
              <div><dt>Time remaining</dt><dd>{Math.max(
                0,
                (state.buffs?.find(buff => buff.id === selected.id)?.expiresAt ?? tick) - tick
              )} phases</dd></div>
              <div><dt>Sleep</dt><dd>Removes this effect</dd></div>
            </dl>
          </section> : <div className="perks-effects">
            <section className="perks-effect perks-effect--benefit" aria-label="Positive bonuses">
              <h4>Positive bonuses</h4>
              <dl>
                <div><dt>Sanity recovery</dt><dd>×{selected.sanityMultiplier}</dd></div>
                <div><dt>Willpower for one day</dt><dd>{signed(selected.willpowerOnUse)}</dd></div>
              </dl>
            </section>
            <section className="perks-effect perks-effect--cost" aria-label="Negative bonuses">
              <h4>Negative bonuses</h4>
              <dl>
                <div><dt>Willpower after a day without use</dt><dd>{signed(selected.willpowerAfterDay)}</dd></div>
                <div><dt>Sanity after a day without use</dt><dd>−{selected.withdrawalFraction * 100}%</dd></div>
              </dl>
            </section>
          </div>}
        </>}
      </section>
    </div>
    <p className="quest-help">{mode === 'effects' ? '↑ / ↓ Select effect · Escape Close' : '↑ / ↓ Select entry · Enter Toggle group · Escape Close'}</p>
  </div>
}
