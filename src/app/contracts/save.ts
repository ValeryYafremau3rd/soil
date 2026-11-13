import type { ItemStack } from '../../domain/inventory/loot'
import type { CourierBoard, QuestProgress } from '../../domain/quests/quests'
import type { DayTimeSnapshot } from './daytime'
import type { StatusSnapshot } from './status'
import type { NotesSnapshot } from './notes'

export interface PlayerPosition { locationId: string; x: number; y: number; buildingId?: string; roomId?: string; floor?: number }
export interface SavedInventory {
  barterAmmoVersion?: 1
  lootedCaches?: readonly string[]
  legendaryBarterStock?: { visible: boolean; items: readonly ItemStack[] }
  deliveryVersion?: 1 | 2
  equipment?: import('../../domain/inventory/items').Equipment
  currencyInInventory?: boolean
  keyItems?: readonly string[]
  items: readonly ItemStack[]
  money: number
  containers: Readonly<Record<string, { items: readonly ItemStack[]; locked: boolean }>>
  deposits: Readonly<Record<string, readonly ItemStack[]>>
}
export interface SaveGame {
  gameVersion?: string
  openingVersion?: 1
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
  travel: { locationId: string; phaseTravels: number }
  unlockedDoors: readonly string[]
  position: PlayerPosition
}
export interface SaveStorage { read(): string | null; write(value: string): void }
export interface OptionsController {
  save(): void
  load(): void
  restart(): void
  exit(): void
  updatePosition(position: PlayerPosition): void
  takeLoadedPosition(): PlayerPosition | null
}
