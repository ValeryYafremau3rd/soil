import type { BuildingDefinition, ItemDefinition, RoomDefinition } from '../../content/types'
import type { QuestDefinition } from '../../domain/quests/quests'
import type { TravelLocation } from '../contracts/travel'
/**
 * Known content identifiers used to validate references in persisted saves.
 */
export interface SaveReferences {
  story?: import('../../domain/quests/story').StoryConfig
  optionalContainerIds?: readonly string[]
  npcIds: readonly string[]
  classIds: readonly string[]
  difficultyIds: readonly string[]
  locations: readonly TravelLocation[]
  items: readonly ItemDefinition[]
  quests: readonly QuestDefinition[]
  containerIds: readonly string[]
  buildings: Readonly<Record<string, BuildingDefinition>>
  rooms: Readonly<Record<string, RoomDefinition>>
  travelsPerPhase: number
}
