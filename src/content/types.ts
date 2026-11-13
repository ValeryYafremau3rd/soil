import type { DialogueDefinition } from '../domain/dialogue/dialogue'
import type { ItemStack } from '../domain/inventory/loot'
import type { DayPhase } from '../app/contracts/daytime'
import type { WanderSettings } from '../domain/npcs/Wanderer'
import type { InventoryItemDefinition, ItemRarity } from '../domain/inventory/items'
import type { PatrolCombatSettings } from '../domain/combat/patrolCombat'
import type { StairConnection } from '../domain/buildings/navigation'

export interface Rect { x: number; y: number; width: number; height: number }
export interface NpcFrame extends Rect { anchorX?: number; anchorY?: number; scale?: number }
export interface ItemDefinition extends InventoryItemDefinition { rarity: ItemRarity; quality: number; name: string; category: string; description?: string; icon: Rect; iconSheet?: { path: string; width: number; height: number }; iconClip?: readonly { x: number; y: number }[]; scale?: number }
export interface SurfaceDefinition { left: number; right: number; top: number; rightTop?: number; bottom?: number }
export interface SpriteDefinition {
  key: string
  path: string
  background: 'none' | 'light' | 'dark'
  referenceWidth?: number
  crop?: Rect
  outline?: readonly { x: number; y: number }[]
}

export interface BuildingView {
  key: string
  groundY: number
  crop: Rect
  floors: readonly { y: number; left: number; right: number; ceiling: number }[]
  platforms?: readonly SurfaceDefinition[]
}

export interface BuildingDefinition {
  name: string
  corridorLights?: boolean
  sprites: readonly SpriteDefinition[]
  outer: BuildingView
  inner: BuildingView
  entranceX: number
  entrances?: readonly number[]
  stairs?: readonly StairConnection[]
  stairX: number
  stairLandingX: number
  interactionRadius: number
  stairDurationMs: number
  scale: number
  rooms?: readonly RoomBinding[]
}

export interface RoomBinding { id: string; type: string; floor: number; x: number; doorX: number }
export interface RoomDefinition {
  name: string
  sprite: SpriteDefinition
  widthScale?: number
  groundY: number
  bounds: { left: number; right: number; ceiling: number }
  platforms?: readonly SurfaceDefinition[]
  furniture?: readonly RoomFurniture[]
  containers?: readonly RoomContainer[]
}

export type RoomContainer = Pick<ContainerPlacement, 'id' | 'type' | 'x' | 'scale' | 'enabled' | 'developerStock' | 'items' | 'lootTable' | 'heightOffset' | 'locked' | 'quality'>

export interface RoomFurniture { id: string; type: string; x: number; scale?: number }
export interface FurnitureDefinition extends SpriteDefinition {
  depth?: number
  name: string
  action: 'rest' | 'sleep' | 'hide' | 'none'
  displayHeight: number
  scale: number
  interactionRadius: number
  prompt: string
  revealPrompt?: string
  platform?: SurfaceDefinition
  platforms?: readonly SurfaceDefinition[]
  groundOrigin?: number
}
export interface FurnitureConfiguration {
  types: Readonly<Record<string, FurnitureDefinition>>
  placements: readonly ObjectPlacement[]
}

export interface NpcDefinition {
  name: string
  sourceKey: string
  textureKey: string
  path: string
  idleAnimation: string
  referenceWidth: number
  frameRate: number
  displayHeight: number
  scale?: number
  background?: 'none' | 'light' | 'dark'
  backgroundThreshold?: number
  backgroundMinGreenRed?: number
  keepLargestComponent?: boolean
  repeat?: number
  depth: number
  interactionRadius: number
  idleSteps: readonly NpcFrame[]
  frameSize?: { width: number; height: number; referenceHeight?: number }
  dialogueId?: string
  dialogue?: DialogueDefinition
  schedule?: Partial<Record<DayPhase, NpcSchedulePosition>>
  walk?: { key: string; frameRate: number; steps: readonly NpcFrame[] }
  run?: { key: string; frameRate: number; steps: readonly NpcFrame[] }
  attack?: { key: string; frameRate: number; steps: readonly NpcFrame[] }
  shoot?: { key: string; frameRate: number; steps: readonly NpcFrame[] }
  death?: { key: string; frameRate: number; steps: readonly NpcFrame[] }
}

export interface PatrolDefinition extends NpcDefinition {
  corpseLoot?: readonly import('../domain/combat/patrolCombat').CorpseDrop[]
  kind?: 'human' | 'monster'
  run: { key: string; frameRate: number; steps: readonly NpcFrame[] }
  death: { key: string; frameRate: number; steps: readonly NpcFrame[] }
  attack: { key: string; frameRate: number; steps: readonly NpcFrame[] }
  combat: PatrolCombatSettings
  walk: { key: string; frameRate: number; steps: readonly NpcFrame[] }
  movement: WanderSettings
}
export interface PatrolLocation {
  type: string
  counts: Record<DayPhase, number>
  bounds: { left: number; right: number }
  scale?: number
  enabled?: boolean
  interiors?: readonly IndoorPatrolLocation[]
  nightEncounters?: readonly { type: string; weight: number; count: number }[]
  emptyInteriorSpawn?: { type: string; chance: number }
}
export interface IndoorPatrolLocation extends Omit<PatrolLocation, 'interiors' | 'nightEncounters'> { id: string; buildingId: string; floor: number }
export interface PatrolConfiguration {
  types: Readonly<Record<string, PatrolDefinition>>
  locations: Readonly<Record<string, PatrolLocation>>
}

export interface NpcSchedulePosition {
  locationId: string
  x: number
  buildingId?: string
  roomId?: string
  floor?: number
  scale?: number
  enabled?: boolean
}

export interface ContainerType extends Rect { name: string; quality: number; displayHeight: number; scale?: number; groundOrigin?: number; platform?: SurfaceDefinition; locked?: boolean }
export interface ObjectPlacement {
  id: string
  locationId: string
  type: string
  x: number
  space: 'outside' | 'inside'
  buildingId?: string
  floor?: number
  enabled?: boolean
  scale?: number
}

export interface ContainerPlacement extends ObjectPlacement {
  restock?: boolean
  developerStock?: boolean
  questId?: string
  questIds?: readonly string[]
  nightOnly?: boolean
  lockRarity?: ItemRarity
  quality?: number
  locked?: boolean
  roomId?: string
  heightOffset?: number
  items?: readonly ItemStack[]
  lootTable?: string
}

export interface TaskboardPlacement extends ObjectPlacement { heightOffset: number }
export interface TaskboardDefinition extends SpriteDefinition {
  name: string
  space: 'outside' | 'inside'
  displayHeight: number
  scale: number
  interactionRadius: number
  prompt: string
  menuId: string
  platform?: SurfaceDefinition
}
export interface TaskboardConfiguration {
  types: Readonly<Record<string, TaskboardDefinition>>
  placements: readonly TaskboardPlacement[]
}

export interface ContainerConfiguration {
  rarityWeights: Record<ItemRarity, number>
  sheet: { sourceKey: string; textureKey: string; path: string; referenceWidth: number; background?: 'none' | 'light' | 'dark' }
  types: Readonly<Record<string, ContainerType>>
  interaction: { radius: number; prompt: string }
  lootTables: Readonly<Record<string, { minItems: number; maxItems: number; itemIds: 'all' | readonly string[]; rarityWeighted?: boolean }>>
  placements: readonly ContainerPlacement[]
}
