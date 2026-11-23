import type { ItemStack } from '../../domain/inventory/loot'
import type { CourierBoard, QuestProgress } from '../../domain/quests/quests'
import type { DayTimeSnapshot } from './daytime'
import type { StatusSnapshot } from './status'
import type { NotesSnapshot } from './notes'

/**
 * Persisted player location and coordinates for restoring the world view.
 */
export interface PlayerPosition {
  locationId: string
  x: number
  y: number
  buildingId?: string
  roomId?: string
  floor?: number
}
/**
 * Persisted inventory contents, equipment and container state.
 */
export interface SavedInventory {
  readBooks?: readonly string[]
  barterAmmoVersion?: 1
  motherJournalVersion?: 1
  lootedCaches?: readonly string[]
  legendaryBarterStock?: {
    visible: boolean
    items: readonly ItemStack[]
  }
  deliveryVersion?: 1 | 2
  equipment?: import('../../domain/inventory/items').Equipment
  currencyInInventory?: boolean
  slotlessMoney?: boolean
  keyItems?: readonly string[]
  items: readonly ItemStack[]
  money: number
  containers: Readonly<Record<string, {
    items: readonly ItemStack[]
    locked: boolean
  }>>
  deposits: Readonly<Record<string, readonly ItemStack[]>>
}
/**
 * Persisted session payload consumed by save validation and compatibility migrations.
 */
export interface SaveGame {
  legacyQuestPrerequisites?: Readonly<Record<string, readonly string[]>>
  story?: import('../../domain/quests/story').StoryState
  gameVersion?: string
  openingVersion?: 1
  escapeCluesVersion?: 1
  version: 1
  savedAt: string
  classId: string
  difficultyId: string
  daytime: DayTimeSnapshot
  status: StatusSnapshot
  inventory: SavedInventory
  quests: readonly QuestProgress[]
  courierBoard?: CourierBoard
  npcJobs?: CourierBoard
  statistics?: import('./statistics').StatisticsSnapshot
  notes?: NotesSnapshot
  intimidatedDays?: Readonly<Record<string, number>>
  adviceDays?: Readonly<Record<string, number>>
  perks?: import('../../domain/character/perks').PerksSnapshot
  awakePhases?: number
  travel: {
    storySeen?: boolean
    locationId: string
    phaseTravels: number
  }
  unlockedDoors: readonly string[]
  position: PlayerPosition
}
/**
 * Platform storage adapter boundary for loading, writing and deleting saved games.
 */
export interface SaveStorage {
  read(): string | null
  write(value: string): void
}
/**
 * Typed options actions and queries exposed across application layers.
 */
export interface OptionsController {
  getDifficulty(): string
  changeDifficulty(id: string): void
  save(): void
  load(): void
  restart(): void
  exit(): void
  updatePosition(position: PlayerPosition): void
  takeLoadedPosition(): PlayerPosition | null
}
