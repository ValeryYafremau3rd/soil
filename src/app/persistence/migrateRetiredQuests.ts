import type { SaveGame } from '../contracts/save'

/**
 * Remove retired strap quest progress without changing inventory or earned rewards.
 * @param {SaveGame} save - Cloned save being prepared for content validation.
 * @returns {void} Updates journal progress in place; repeated migration is safe.
 */
export function migrateRetiredQuests(save: SaveGame): void {
  save.quests = save.quests.filter(quest => quest.questId !== 'a-fraying-strap')
}
