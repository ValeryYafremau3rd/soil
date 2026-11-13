import type { SaveGame } from '../contracts/save'
import type { SaveReferences } from './saveReferences.ts'

export function migrateOpening(save: SaveGame, references: SaveReferences): void {
if (!save.openingVersion) {
    save.quests = save.quests.map(quest => quest.questId === 'way-out-of-town'
      && references.quests.find(definition => definition.id === quest.questId)?.stages[0]?.id === 'run-east'
      ? { ...quest, stageIndex: quest.stageIndex + 1 } : quest)
    save.openingVersion = 1
  }
}
