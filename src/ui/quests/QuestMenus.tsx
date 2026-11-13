import { useState,useSyncExternalStore } from 'react'
import type { QuestController } from '../../app/contracts/quests'
import { ITEM_BY_ID } from '../../content/items'
import type { QuestDefinition } from '../../domain/quests/quests'
import { activeQuestStages } from '../../domain/quests/quests'
import { isModifiedOrComposing } from '../../platform/ui/isModifiedOrComposing.ts'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { QuestText } from '../notes/QuestText'
import type { NoteTarget } from '../notes/QuestText'
import './quests.css'

type QuestMenuProps = { quests: QuestController; onOpenNote: (target: NoteTarget) => void }

function QuestReward({ quest, onOpenNote }: { quest: QuestDefinition; onOpenNote: (target: NoteTarget) => void }) {
  if (!quest.reward) return null
  const parts = (quest.reward.items ?? []).map(item => `${ITEM_BY_ID[item.itemId]?.name ?? item.itemId} ×${item.quantity}`)
  if (quest.reward.money) parts.push(`${quest.reward.money} Thalers`)
  return <p className="quest-reward">Reward: <QuestText text={parts.join(' · ')} onOpenNote={onOpenNote} /></p>
}

function moveQuest(quests: readonly QuestDefinition[], selected: string | undefined, direction: number, onSelect: (id: string) => void, root: HTMLElement, wrap = true) {
  if (!quests.length) return
  const index = Math.max(0, quests.findIndex(quest => quest.id === selected))
  const next = wrap ? (index + direction + quests.length) % quests.length : Math.max(0, Math.min(quests.length - 1, index + direction))
  onSelect(quests[next].id)
  root.querySelectorAll<HTMLButtonElement>('.quest-names button')[next]?.focus()
}

function QuestNames({ quests, selected, onSelect }: { quests: readonly QuestDefinition[]; selected?: string; onSelect: (id: string) => void }) {
  return <nav className="quest-names" aria-label="Quest names">
    {quests.map(quest => <button type="button" key={quest.id} aria-current={quest.id === selected ? 'true' : undefined}
      data-autofocus={quest.id === selected ? true : undefined} tabIndex={quest.id === selected ? 0 : -1}
      onClick={() => onSelect(quest.id)} onFocus={() => onSelect(quest.id)}>{quest.name}</button>)}
  </nav>
}

export function QuestJournal({ quests, onOpenNote }: QuestMenuProps) {
  const { progress } = useSyncExternalStore(quests.subscribe, quests.getSnapshot)
  const [tab, setTab] = useState<'active' | 'finished'>('active')
  const [selectedId, setSelectedId] = useState('')
  const entries = quests.definitions.filter(quest => {
    const current = progress.find(entry => entry.questId === quest.id)
    return current && (tab === 'finished' ? current.stageIndex >= quest.stages.length : current.stageIndex < quest.stages.length)
  })
  const selected = entries.find(quest => quest.id === selectedId) ?? entries[0]
  const current = progress.find(entry => entry.questId === selected?.id)
  const activeStages = selected && current ? activeQuestStages(selected, current) : []
  const visibleEnd = selected && current ? Math.max(current.stageIndex, ...activeStages.map(stage => selected.stages.indexOf(stage)),
    ...selected.stages.map((stage, index) => current.completedStageIds?.includes(stage.id) ? index : 0)) : 0
  return <div className="quest-journal" onKeyDownCapture={event => {
    if (isModifiedOrComposing(event)) return
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const next = tab === 'active' ? 'finished' : 'active'
      setTab(next)
      setSelectedId('')
      event.currentTarget.querySelector<HTMLButtonElement>(`#quest-tab-${next}`)?.focus()
    } else moveQuest(entries, selected?.id, event.key === 'ArrowDown' ? 1 : -1, setSelectedId, event.currentTarget)
  }}>
    <div className="quest-tabs" role="tablist" aria-label="Quest status">
      {(['active', 'finished'] as const).map(status => <button key={status} type="button" role="tab" id={`quest-tab-${status}`}
        aria-selected={status === tab} aria-controls="quest-panel" tabIndex={status === tab ? 0 : -1}
        data-autofocus={status === tab ? true : undefined} onClick={() => { setTab(status); setSelectedId('') }}>
        {status === 'active' ? 'Active' : 'Finished'}
      </button>)}
    </div>
    <div id="quest-panel" role="tabpanel" aria-labelledby={`quest-tab-${tab}`}>
      {!selected || !current ? <p>{tab === 'active' ? 'No active quests. Visit a taskboard to accept one.' : 'No finished quests yet.'}</p> :
        <div className="quest-layout">
          <QuestNames quests={entries} selected={selected.id} onSelect={setSelectedId} />
          <section className="quest-details" aria-label="Quest stages">
            <h3><QuestText text={selected.name} onOpenNote={onOpenNote} /></h3>
            <p><QuestText text={selected.description} onOpenNote={onOpenNote} /></p>
            <QuestReward quest={selected} onOpenNote={onOpenNote} />
            {current.failed && <p role="status">Delivery expired.</p>}
            {!current.failed && current.deadline !== undefined && tab === 'active' && <p>Deadline: day {Math.floor(current.deadline / 4) + 1}, {['morning', 'afternoon', 'evening', 'night'][current.deadline % 4]} (finish before this phase).</p>}
            {tab === 'finished' && <p className="quest-finished">Quest finished.</p>}
            <ol className="quest-stages">{selected.stages.slice(0, visibleEnd + 1).map((stage, index) =>
              <li key={stage.id} className={index < current.stageIndex || current.completedStageIds?.includes(stage.id) ? 'is-finished' : 'is-active'}>
                <strong>{index < current.stageIndex || current.completedStageIds?.includes(stage.id) ? 'Completed' : 'Current stage'}</strong>
                <p><QuestText text={stage.description} onOpenNote={onOpenNote} /></p>
              </li>)}</ol>
          </section>
        </div>}
    </div>
    <p className="quest-help">← / → Switch tabs · ↑ / ↓ Select quest · Escape Close</p>
  </div>
}

export function QuestBoard({ quests, onOpenNote }: QuestMenuProps) {
  const { boardOpen, courierBoard } = useSyncExternalStore(quests.subscribe, quests.getSnapshot)
  const [selectedId, setSelectedId] = useState('')
  if (!boardOpen) return null
  const available = quests.getBoardQuests()
  const selected = available.find(quest => quest.id === selectedId) ?? available[0]
  const accept = () => {
    if (!selected) return
    quests.accept(selected.id)
  }
  return <Modal title="Available quests" onClose={quests.closeBoard} className="quest-modal">
    <div onKeyDownCapture={event => {
      if (isModifiedOrComposing(event)) return
      if ((event.target as HTMLElement).closest('.quest-note-link')) return
      if (!['Enter', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Enter') { if (!event.repeat) accept() }
      else moveQuest(available, selected?.id, event.key === 'ArrowDown' ? 1 : -1, setSelectedId, event.currentTarget, false)
    }}>
    <p>Day {courierBoard.day}: {courierBoard.acceptedQuestIds.filter(id => quests.definitions.find(quest => quest.id === id)?.deliveryKind === 'courier').length} of {courierBoard.offeredQuestIds.filter(id => quests.definitions.find(quest => quest.id === id)?.deliveryKind === 'courier').length} courier jobs accepted. New notices each morning.</p>
    {!selected ? <p>No new quests available today. Accepted quests are in your quest journal.</p> : <div className="quest-layout">
      <QuestNames quests={available} selected={selected.id} onSelect={setSelectedId} />
      <section className="quest-details" aria-label="Quest notice">
        <h3><QuestText text={selected.name} onOpenNote={onOpenNote} /></h3>
        <p><QuestText text={selected.description} onOpenNote={onOpenNote} /></p>
        {selected.repeatable && <p>Daily job. Can be accepted once today; new offers arrive each morning.</p>}
        {selected.findItem && <p>Find-item request: bring one <QuestText text={ITEM_BY_ID[selected.findItem].name} onOpenNote={onOpenNote} /> to the named recipient.
          Payment is exactly twice its listed price.</p>}
        <QuestReward quest={selected} onOpenNote={onOpenNote} />
        <p><QuestText text={selected.stages[0].description} onOpenNote={onOpenNote} /></p>
        <Button onClick={accept}>Accept quest</Button>
      </section>
    </div>}
    <p className="quest-help">↑ / ↓ Select quest · Enter Accept · Escape Close</p>
    </div>
  </Modal>
}
