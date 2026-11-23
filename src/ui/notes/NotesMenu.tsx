import { useState, useSyncExternalStore } from "react"
import type { InventoryController } from '../../app/contracts/inventory'
import type { NotesController } from "../../app/contracts/notes"
import type { QuestController } from '../../app/contracts/quests'
import { NPCS } from '../../content/npcs'
import { AddItemButton } from './AddItemButton'
import { QuestNote } from './QuestNote'
import type { PerksController } from '../../app/contracts/perks'
import { ITEM_BY_ID } from "../../content/items"
import skillsConfig from '../../content/skills.json'
import type { Character } from '../../domain/skills/character'
import { SKILL_LABELS } from '../../domain/skills/character'
import type { NoteTarget } from './QuestText'
import { ItemNote } from './ItemNote'
import { LocationNote } from './LocationNote'
import type { Tab } from './noteEntries'
import { name, TABS } from './noteEntries'
import { itemGroup } from './itemGroups'
import "./notes.css"
import { menuKeyboard } from '../components/menuKeyboard'
import { PerkNote } from './PerkNote'
import { PersonNote } from './PersonNote'

/**
 * Perform notes menu.
 * @param {object} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function NotesMenu({
  notes,
  initialTarget,
  inventory,
  perks,
  quests,
}: {
  notes: NotesController
  initialTarget?: NoteTarget
  inventory: InventoryController
  perks: PerksController
  quests: QuestController
}) {
  const notesState = useSyncExternalStore(notes.subscribe, notes.getSnapshot)
  const perkState = useSyncExternalStore(perks.subscribe, perks.getSnapshot)
  useSyncExternalStore(quests.subscribe, quests.getSnapshot)
  useSyncExternalStore(inventory.subscribe, inventory.getSnapshot)
  const perkEntries = [
    ...skillsConfig.legendary.perks.map(perk => ({
      ...perk,
      id: `legendary:${perk.skill}`,
      name: `Legendary ${SKILL_LABELS[perk.skill as keyof Character['skills']]}`
    })),
    ...perks.definitions,
    ...perks.buffDefinitions.map(buff => ({ ...buff, id: `buff:${buff.id}` }))
  ]
  const definitions = quests.definitions
  const discovered = {
    ...notesState,
    perks: perkEntries.map(perk => perk.id),
    quests: definitions.map(quest => quest.id)
  }
  const [tab, setTab] = useState<Tab>(initialTarget?.category ?? "locations")
  const [selection, setSelection] = useState<Partial<Record<Tab, string>>>(initialTarget ? { [initialTarget.category]: initialTarget.id } : {})
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => {
    const item = initialTarget?.category === 'items' ? ITEM_BY_ID[initialTarget.id] : undefined

    return new Set(item ? [itemGroup(item)] : [])
  })
  const groups = new Map<string, string[]>()

  for (const id of tab === 'quests' ? discovered.quests : tab === 'perks' ? discovered.perks : discovered.items) {
    if (tab === 'quests') {
      const provider = definitions.find(quest => quest.id === id)?.offeredBy
      const group = provider ? NPCS[provider]?.name ?? provider : 'No offering NPC'
      groups.set(group, [...(groups.get(group) ?? []), id])
      continue
    }

    const category = tab === 'perks' ? (id.startsWith('legendary:') ? 'Legendary perks' : id.startsWith('buff:') ? 'Temporary effects' : 'Permanent perks') : ITEM_BY_ID[id].category
    const group = tab === 'perks' ? category : itemGroup(ITEM_BY_ID[id])
    groups.set(group, [...(groups.get(group) ?? []), id])
  }

  const selected =
    selection[tab] && discovered[tab].includes(selection[tab]!)
      ? selection[tab]
      : discovered[tab][0]

  return (
    <div
      className="notes-menu"
      onKeyDownCapture={event => menuKeyboard(
        event,
        { tabs: '.notes-tabs button', items: '.notes-entries button', wrap: false }
      )}
    >
      <div
        className="notes-tabs"
        role="tablist"
        aria-label="Note categories"
        aria-orientation="horizontal"
      >
        {(Object.keys(TABS) as Tab[]).map((category) => (
          <button
            type="button"
            key={category}
            id={`notes-tab-${category}`}
            role="tab"
            aria-selected={tab === category}
            aria-controls="notes-panel"
            tabIndex={tab === category ? 0 : -1}
            data-autofocus={tab === category || undefined}
            onClick={() => setTab(category)}
          >
            {TABS[category]} <span>{discovered[category].length}</span>
          </button>
        ))}
      </div>
      <div
        className="notes-layout"
        id="notes-panel"
        role="tabpanel"
        aria-labelledby={`notes-tab-${tab}`}
      >
        <aside className="notes-sidebar">
          <ul className="notes-entries" aria-label={`All ${tab}`}>
            {tab === 'items' || tab === 'perks' || tab === 'quests' ? [...groups].map((
              [group, ids],
              index
            ) => (
              <li key={group}>
                <button type="button" className="notes-group" aria-expanded={expandedGroups.has(group)}
                  aria-controls={`notes-group-${index}`}
                  onClick={() => setExpandedGroups(current => {
                    const next = new Set(current)
                    if (next.has(group)) next.delete(group); else next.add(group)

                    return next
                  })}>
                  {expandedGroups.has(group) ? '▾' : '▸'} {group} ({ids.length})
                </button>
                <ul id={`notes-group-${index}`} className="notes-group-items" hidden={!expandedGroups.has(group)}>
                  {expandedGroups.has(group) && ids.map(id => (
                    <li key={id}>
                      <button type="button" aria-pressed={selected === id}
                        onFocus={() => setSelection(current => ({ ...current, [tab]: id }))}
                        onClick={() => setSelection(current => ({ ...current, [tab]: id }))}>
                        {tab === 'quests' ? definitions.find(quest => quest.id === id)?.name : tab === 'perks' ? perkEntries.find(perk => perk.id === id)?.name : name('items', id)}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            )) : discovered[tab].map((id) => (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={selected === id}
                  onFocus={() => setSelection(current => ({ ...current, [tab]: id }))}
                  onClick={() =>
                    setSelection((current) => ({ ...current, [tab]: id }))
                  }
                >
                  {name(tab, id)}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="notes-details" aria-label="Note details">
          {selected ? (
            tab === 'quests' ? <QuestNote key={selected} id={selected} quests={quests} /> : tab === 'perks' ? <PerkNote id={selected} perks={perks} state={perkState} skills={inventory.getSkills()} />
              : <>{tab === 'locations' ? <LocationNote id={selected} /> : tab === 'people' ? <PersonNote id={selected} /> : <><ItemNote id={selected} inventory={inventory} /><AddItemButton key={selected} id={selected} inventory={inventory} /></>}</>
          ) : (
            <p>
              No entries available.
            </p>
          )}
        </section>
      </div>
      <p className="notes-help">
        ← / → Switch tabs · ↑ / ↓ Select entry · Enter Toggle group · Escape Close
      </p>
    </div>
  )
}
