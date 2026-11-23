import type { SaveGame } from '../contracts/save'
import type { SaveReferences } from './saveReferences'
import { checkSave } from './checkSave.ts'

const LEGACY_KEY_STAGE = 2
const LEGACY_COMPLETED_STAGE = 3

/**
 * Translate older main-quest indices after adding the two independent testimony stages.
 * @param {SaveGame} save - Cloned save after the historical opening-stage migration.
 * @param {SaveReferences} references - Current stage definitions used to locate recovered keys.
 * @returns {void} Preserves finished exits and key recovery without inventing clue testimony.
 */
export function migrateEscapeClues(save: SaveGame, references: SaveReferences): void {
  const quest = references.quests.find(quest => quest.id === 'way-out-of-town')
  if (save.escapeCluesVersion || !quest?.stages.some(stage => stage.id === 'guard-key-clue')) return

  const recovered = quest.stages.findIndex(stage => stage.id === 'strange-key')
  save.quests = save.quests.map(entry => {
    if (entry.questId !== quest.id) return entry

    checkSave(entry.stageIndex <= LEGACY_COMPLETED_STAGE)
    if (entry.stageIndex < LEGACY_KEY_STAGE) return entry

    return { ...entry, stageIndex: entry.stageIndex === LEGACY_KEY_STAGE
      ? recovered : quest.stages.length, completedStageIds: [] }
  })
  save.escapeCluesVersion = 1
}
