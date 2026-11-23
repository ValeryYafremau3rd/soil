import type { SaveGame } from '../contracts/save'
import type { SaveReferences } from './saveReferences'
import { isQuestCompleted } from '../../domain/quests/quests.ts'
import { checkSave as check } from './checkSave.ts'

// Historical additions are compatibility limits, never inferred from arbitrary future prerequisites.
const ADDED_PREREQUISITES: Readonly<Record<string, readonly string[]>> = {
  'bartender-letter': ['cashier-3'],
  'factory-supplies': ['town-opinions'],
  'milena-mother-journal': ['nurse-tablet-deliveries'],
}

/**
 * Grandfather only recorded old quest runs across the three newly added story gates.
 * @param {SaveGame} save - Cloned legacy payload; inventory, rewards and progress stay untouched.
 * @param {SaveReferences} references - Current quest definitions for completion checks.
 * @returns {void} Stores narrow exemptions so later saves retain compatibility without free rewards.
 */
export function migrateStoryPrerequisites(save: SaveGame, references: SaveReferences): void {
  if (save.story || save.legacyQuestPrerequisites) return
  const exemptions: Record<string, readonly string[]> = {}
  for (const run of save.quests) {
    const missing = (ADDED_PREREQUISITES[run.questId] ?? []).filter(id =>
      references.quests.some(q => q.id === run.questId && q.prerequisites?.includes(id))
      && !isQuestCompleted(id, save.quests, references.quests))
    if (missing.length) exemptions[run.questId] = missing
  }
  if (Object.keys(exemptions).length) save.legacyQuestPrerequisites = exemptions
}

/**
 * Verify saved exemptions cannot unlock new quests or bypass unrelated prerequisites.
 * @param {SaveGame} save - Shape-checked save containing optional compatibility exemptions.
 * @returns {void} Throws if any exemption is outside the known historical additions.
 */
export function validateLegacyStoryPrerequisites(save: SaveGame): void {
  for (const [questId, ids] of Object.entries(save.legacyQuestPrerequisites ?? {})) {
    check(save.quests.some(run => run.questId === questId))
    check(ids.every(id => ADDED_PREREQUISITES[questId]?.includes(id)))
    check(new Set(ids).size === ids.length)
  }
}
