import type { DialogueChoice } from '../../domain/dialogue/dialogue'
import type { StoryState } from '../../domain/quests/story'

/** Narrative state owner exposed to dialogue, world presentation and persistence. */
export interface StoryController {
  getSnapshot(): StoryState
  subscribe(listener: () => void): () => void
  canChoose(choice: DialogueChoice): boolean
  decide(id: string, value: string): boolean
  isNpcAbsent(npcId: string): boolean
  interact(id: string): boolean
}
