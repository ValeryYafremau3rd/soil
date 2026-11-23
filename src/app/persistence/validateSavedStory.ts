import type { SaveGame } from '../contracts/save'
import type { SaveReferences } from './saveReferences'
import { checkSave as check } from './checkSave.ts'
import { isQuestCompleted } from '../../domain/quests/quests.ts'

/**
 * Validate persistent narrative decisions, delayed NPC removals and terminal route consistency.
 * @param {SaveGame} save - Shape-checked cloned save payload.
 * @param {SaveReferences} references - Known content IDs and optional story rules.
 * @returns {void} Throws for forged NPC IDs, invalid decisions or inconsistent endings.
 */
export function validateSavedStory(save: SaveGame, references: SaveReferences): void {
  const state = save.story
  if (!state) return
  check(new Set(state.absentNpcIds).size === state.absentNpcIds.length)
  check(new Set(state.consequences.map(effect => effect.npcId)).size === state.consequences.length)
  for (const id of [...state.absentNpcIds, ...state.consequences.map(effect => effect.npcId)]) {
    check(references.npcIds.includes(id))
  }
  for (const [id, value] of Object.entries(state.decisions)) {
    const definition = references.story?.decisions.find(decision => decision.id === id)
    if (references.story) check(definition?.options.some(option => option.value === value))
  }
  if (state.flags.prologue_complete || state.flags.ending_route) {
    check(state.flags.prologue_complete === true)
    check(['illegal', 'official'].includes(String(state.flags.ending_route)))
    check(isQuestCompleted('way-out-of-town', save.quests, references.quests))
    check(isQuestCompleted('prologue-last-night', save.quests, references.quests))
    if (state.flags.ending_route === 'official') {
      check(isQuestCompleted('prologue-government-exit', save.quests, references.quests))
      check(state.decisions.government_exit_bargain === 'accept')
    }
  }
}
