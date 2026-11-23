import type { DialogueChoice } from '../dialogue/dialogue'
import type { EndingSlidesConfig } from './endingSlides'

/** Saved narrative facts; route names are strings and discovered clues are booleans. */
export interface StoryState {
  readonly flags: Readonly<Record<string, boolean | string>>
  readonly decisions: Readonly<Record<string, string>>
  readonly consequences: readonly { npcId: string; day: number }[]
  readonly absentNpcIds: readonly string[]
}

/** An authored branch with mutually exclusive outcomes and delayed NPC removal. */
export interface StoryDecision {
  id: string
  questId: string
  choiceId: string
  legacyDefault: string
  options: readonly { value: string; npcId?: string }[]
}

/** A world clue or exit, placed in existing scenery without introducing artwork. */
export interface StoryInteraction {
  id: string
  name: string
  locationId: string
  x: number
  buildingId?: string
  roomId?: string
  floor?: number
  text: string
  questId?: string
  stageId?: string
  route?: 'illegal' | 'official'
  absentNpcId?: string
  fallbackNpcId?: string
}

/** Executable narrative rules, separate from non-executable quest design metadata. */
export interface StoryConfig {
  endingSlides: EndingSlidesConfig
  messages: {
    interact: string
    unavailable: string
    illegalBlocked: string
    officialBlocked: string
    leave: string
    complete: string
    save: string
    load: string
    newGame: string
  }
  consequenceDelayDays: number
  interactionRadius: number
  completedFlags: Readonly<Record<string, string>>
  decisions: readonly StoryDecision[]
  interactions: readonly StoryInteraction[]
  ending: { illegal: string; official: string }
}

/**
 * Check explicit story conditions on a reply without changing state.
 * @param {DialogueChoice} choice - Authored reply being considered.
 * @param {StoryState} state - Current immutable narrative snapshot.
 * @returns {boolean} Whether all required facts and decisions match.
 */
export function meetsStoryConditions(choice: DialogueChoice, state: StoryState): boolean {
  return Object.entries(choice.storyConditions ?? {}).every(([id, value]) =>
    (state.flags[id] ?? state.decisions[id]) === value)
}
