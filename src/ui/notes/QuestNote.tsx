import { useState, useSyncExternalStore } from 'react'
import type { QuestController } from '../../app/contracts/quests'

/**
 * Perform quest note.
 * @param {{ id: string quests: QuestController }} options - The options supplied to this operation.
 * @returns {Element | null} The result described by the TypeScript return signature.
 */
export function QuestNote({ id, quests }: {
  id: string
  quests: QuestController
}) {
  useSyncExternalStore(quests.subscribe, quests.getSnapshot)
  const [message, setMessage] = useState('')
  const quest = quests.definitions.find(entry => entry.id === id)
  if (!quest) return null

  return <>
    <h3>{quest.name}</h3><p>{quest.description}</p>
    <ol>{quest.stages.map(stage => <li key={stage.id}>{stage.description}</li>)}</ol>
    <button type="button" disabled={quests.isActive(id)} onClick={() => {
      setMessage(quests.startForTesting(id) ? `Started: ${quest.name}.` : 'Quest is already active.')
    }}>{quests.isActive(id) ? 'Already active' : 'Start quest without conditions'}</button>
    <p role="status">{message}</p>
  </>
}
