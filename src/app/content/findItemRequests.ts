import type { ItemDefinition } from '../../content/types'
import type { QuestDefinition } from '../../domain/quests/quests'
import type { DialogueDefinition } from '../../domain/dialogue/dialogue'

/** Populate one generic request with catalogue choices; never create a quest per item. */
export function buildFindItemRequests(items: readonly ItemDefinition[], authored: readonly QuestDefinition[],
  dialogues: Readonly<Record<string, DialogueDefinition>>): { quests: readonly QuestDefinition[]; dialogues: Readonly<Record<string, DialogueDefinition>> } {
  return { dialogues, quests: authored.map(quest => quest.findItem === '$item' ? { ...quest,
    findItemOptions: items.filter(item => item.saleable !== false && item.category !== 'Quest' && !item.keys && typeof item.name === 'string' && typeof item.price === 'number' && item.price > 0)
      .map(item => ({ id: item.id, name: item.name, price: item.price, rarity: item.rarity })),
  } : quest) }
}
