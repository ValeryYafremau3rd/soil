import { useSyncExternalStore } from 'react'
import type { DialogueController } from '../../app/contracts/dialogue'
import { Modal } from '../components/Modal'
import { SelectionList } from '../components/SelectionList'
import './dialogue.css'

export function DialogueMenu({ dialogue }: { dialogue: DialogueController }) {
  const { conversation } = useSyncExternalStore(dialogue.subscribe, dialogue.getSnapshot)
  if (!conversation) return null
  const investigating = conversation.kind === 'investigation'
  const actionsLabel = investigating ? 'Your actions' : 'Your replies'
  return <Modal title={conversation.npcName} onClose={dialogue.closeDialogue} className="dialogue-modal">
    {!investigating && <div className="dialogue-trust" aria-label={`Trust: ${conversation.trust ?? 0} of 5`}>
      <span aria-hidden="true">Trust {'●'.repeat(conversation.trust ?? 0)}{'○'.repeat(5 - (conversation.trust ?? 0))}</span>
    </div>}
    <div className="dialogue-layout">
      <section className="dialogue-speech" aria-label={investigating ? 'Your thoughts' : 'NPC text'} aria-live="polite">
        <p>{conversation.text}</p>
      </section>
      <section className="dialogue-replies" aria-label={actionsLabel}>
        <SelectionList label={actionsLabel} wrap={false} items={conversation.choices.map(choice => ({
          id: choice.id, label: choice.text,
        }))} onChoose={dialogue.chooseReply} />
        <p className="dialogue-help">W / S: Select · Enter: {investigating ? 'Act' : 'Reply'} · Escape: Close</p>
      </section>
    </div>
  </Modal>
}
