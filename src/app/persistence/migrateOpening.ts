import type { SaveGame } from '../contracts/save'
import type { SaveReferences } from './saveReferences.ts'

/**
 * Perform migrate opening.
 * @param {SaveGame} save - The save supplied to this operation.
 * @param {SaveReferences} references - The references supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function migrateOpening(
  save: SaveGame,
  references: SaveReferences
): void {
  // The former work introduction already issued the apartment keys.
  if (references.quests.some(quest => quest.id === 'first-steps')
    && !save.quests.some(quest => quest.questId === 'first-steps')
    && save.quests.some(quest => quest.questId === 'find-work' && quest.stageIndex > 0)) {
    save.quests = [...save.quests, { questId: 'first-steps', stageIndex: 1 }]
  }

  if (!save.openingVersion) {
    save.quests = save.quests.map(quest => quest.questId === 'way-out-of-town'
      && references.quests.find(definition => definition.id === quest.questId)?.stages[0]?.id === 'run-east'
      ? { ...quest, stageIndex: quest.stageIndex + 1 } : quest)
    save.openingVersion = 1
  }
}
