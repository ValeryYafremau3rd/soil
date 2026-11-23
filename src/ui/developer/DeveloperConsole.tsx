import { useState, useSyncExternalStore } from 'react'
import type { InventoryController } from '../../app/contracts/inventory'
import type { QuestController } from '../../app/contracts/quests'
import { ITEMS, ITEM_BY_ID } from '../../content/items'
import { NPCS } from '../../content/npcs'
import { ItemNote } from '../notes/ItemNote'
import { itemGroup } from '../notes/itemGroups'
import { developerKeyboard } from './developerKeyboard'
import '../notes/notes.css'

/**
 * Perform developer console.
 * @param {{ inventory: InventoryController quests: QuestController }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function DeveloperConsole({ inventory, quests }: {
  inventory: InventoryController
  quests: QuestController
}) {
  useSyncExternalStore(inventory.subscribe, inventory.getSnapshot)
  useSyncExternalStore(quests.subscribe, quests.getSnapshot)
  const [tab, setTab] = useState<'items' | 'quests'>('items')
  const [selection, setSelection] = useState('')
  const [message, setMessage] = useState('')
  const [expandedNpcs, setExpandedNpcs] = useState<ReadonlySet<string>>(new Set())
  const definitions = quests.definitions
  const entries = tab === 'items' ? ITEMS : definitions
  const selected = entries.find(entry => entry.id === selection) ?? entries[0]
  const quest = tab === 'quests' ? definitions.find(entry => entry.id === selected?.id) : undefined
  const active = !!quest && quests.isActive(quest.id)
  const groups = new Map<string, {
    id: string
    name: string
  }[]>()

  for (const entry of entries) {
    const provider = tab === 'quests' ? definitions.find(definition => definition.id === entry.id)?.offeredBy : undefined
    const label = tab === 'items' ? itemGroup(ITEM_BY_ID[entry.id])
      : provider ? NPCS[provider]?.name ?? provider : 'No offering NPC'
    const group = groups.get(label) ?? []
    group.push(entry)
    groups.set(label, group)
  }

  /**
   * Perform entry button.
   * @param {{ id: string; name: string; }} entry - The entry supplied to this operation.
   * @returns {Element} The result described by the TypeScript return signature.
   */
  const entryButton = (entry: {
    id: string
    name: string
  }) => <li key={entry.id}>
      <button type="button" aria-pressed={selected?.id === entry.id}
        onFocus={() => {
          setSelection(entry.id)
          setMessage('')
        }}
        onClick={() => {
          setSelection(entry.id)
          setMessage('')
        }}>{entry.name}</button>
    </li>

  /**
   * Perform act.
   * @returns {void} Completes the operation without returning a value.
   */
  const act = () => {
    if (!selected) return

    if (tab === 'items') {
      const added = inventory.tryExchangeItems([], [{ itemId: selected.id, quantity: 1 }])
      setMessage(added ? `Added: ${selected.name}.` : 'No free room in inventory.')
    } else {
      setMessage(quests.startForTesting(selected.id) ? `Started: ${selected.name}.` : 'Quest is already active.')
    }
  }

  return <div className="notes-menu" onKeyDownCapture={event => developerKeyboard(event, act)}>
    <div className="notes-tabs" role="tablist" aria-label="Developer categories">
      {(['items', 'quests'] as const).map(category => <button type="button" key={category}
        role="tab" id={`developer-tab-${category}`} aria-controls="developer-panel" aria-selected={tab === category}
        data-autofocus={tab === category || undefined}
        onClick={() => {
          setTab(category)
          setSelection('')
          setMessage('')
        }}>
        {category === 'items' ? 'Items' : 'Quests'} <span>{category === 'items' ? ITEMS.length : quests.definitions.length}</span>
      </button>)}
    </div>
    <div className="notes-layout" role="tabpanel" id="developer-panel" aria-labelledby={`developer-tab-${tab}`}>
      <aside className="notes-sidebar">
        <ul className="notes-entries" aria-label={`All ${tab}`}>
          {[...groups].map((
            [label, definitions],
            index
          ) => {
            const expanded = tab === 'items' || expandedNpcs.has(label)

            return <li key={label}>
              {tab === 'items' ? <h4>{label} ({definitions.length})</h4> : <button type="button"
                className="notes-group" aria-expanded={expanded} aria-controls={`developer-group-${index}`}
                onClick={() => setExpandedNpcs(current => {
                  const next = new Set(current)
                  if (next.has(label)) next.delete(label); else next.add(label)

                  return next
                })}>{expanded ? '▾' : '▸'} {label} ({definitions.length})</button>}
              <ul id={`developer-group-${index}`} className="notes-group-items" hidden={!expanded}
                aria-label={`${tab}: ${label}`}>{expanded && definitions.map(entryButton)}</ul>
            </li>
          })}
        </ul>
      </aside>
      <section className="notes-details" aria-label="Selected entry">
        {selected && <>
          {tab === 'items' ? <ItemNote id={selected.id} inventory={inventory} /> : <>
            <h3>{quest?.name}</h3><p>{quest?.description}</p>
            <ol>{quest?.stages.map(stage => <li key={stage.id}>{stage.description}</li>)}</ol>
          </>}
          <p><code>{selected.id}</code></p>
          <button type="button" disabled={active} onClick={act}>
            {tab === 'items' ? 'Add one to inventory' : active ? 'Already active' : 'Start quest without conditions'}
          </button>
        </>}
        <p role="status">{message}</p>
      </section>
    </div>
    <p className="notes-help">Left / Right: tabs. Up / Down: select. Home / End: first / last. Enter: toggle group / add item / start quest. X / Escape: close.</p>
  </div>
}
