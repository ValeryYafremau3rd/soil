import type { DialogueDefinition } from '../domain/dialogue/dialogue'
import type { ItemStack } from '../domain/inventory/loot'
import type { DayPhase } from '../app/contracts/daytime'
import type { WanderSettings } from '../domain/npcs/Wanderer'
import type { InventoryItemDefinition, ItemRarity } from '../domain/inventory/items'
import type { PatrolCombatSettings } from '../domain/combat/patrolCombat'
import type { StairConnection } from '../domain/buildings/navigation'

/**
 * Pixel rectangle used for source crops and other rectangular content regions.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
/**
 * NPC sprite crop with optional anchor, scale and excluded artwork regions.
 */
export interface NpcFrame extends Rect {
  anchorX?: number
  anchorY?: number
  scale?: number
  excludeRegions?: readonly Rect[]
}
/**
 * Authored item presentation combined with engine-independent inventory rules.
 */
export interface ItemDefinition extends InventoryItemDefinition {
  rarity: ItemRarity
  quality: number
  name: string
  category: string
  description?: string
  icon: Rect
  iconSheet?: {
    path: string
    width: number
    height: number
  }
  iconClip?: readonly {
    x: number
    y: number
  }[]
  scale?: number
}
/**
 * Normalized support-surface geometry attached to a world object.
 */
export interface SurfaceDefinition {
  left: number
  right: number
  top: number
  rightTop?: number
  bottom?: number
}
/**
 * Authored sprite asset identity, crop and background preparation settings.
 */
export interface SpriteDefinition {
  key: string
  path: string
  background: 'none' | 'light' | 'dark'
  referenceWidth?: number
  crop?: Rect
  outline?: readonly {
    x: number
    y: number
  }[]
}

/**
 * Building artwork and geometry for one exterior or interior view.
 */
export interface BuildingView {
  key: string
  groundY: number
  crop: Rect
  floors: readonly {
    y: number
    left: number
    right: number
    ceiling: number
  }[]
  platforms?: readonly SurfaceDefinition[]
}

/**
 * Reusable building type with views, floors, stairs and presentation settings.
 */
export interface BuildingDefinition {
  name: string
  corridorLights?: boolean
  corridorTint?: number
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

/**
 * Binding between a placed building and its authored room definition.
 */
export interface RoomBinding {
  id: string
  type: string
  floor: number
  x: number
  doorX: number
}
/**
 * Authored room artwork, movement bounds, furniture and interaction content.
 */
export interface RoomDefinition {
  name: string
  sprite: SpriteDefinition
  widthScale?: number
  groundY: number
  bounds: {
    left: number
    right: number
    ceiling: number
  }
  platforms?: readonly SurfaceDefinition[]
  furniture?: readonly RoomFurniture[]
  containers?: readonly RoomContainer[]
}

export type RoomContainer = Pick<ContainerPlacement,
  'id' |
  'type' |
  'x' |
  'scale' |
  'enabled' |
  'developerStock' |
  'items' |
  'lootTable' |
  'heightOffset' |
  'locked' |
  'quality' |
  'keyOnly' |
  'restock'
>

/**
 * Room-local furniture placement attached to an authored furniture type.
 */
export interface RoomFurniture {
  id: string
  type: string
  x: number
  scale?: number
}
/**
 * Reusable furniture artwork, action, prompt and support geometry.
 */
export interface FurnitureDefinition extends SpriteDefinition {
  depth?: number
  name: string
  action: 'rest' | 'sleep' | 'hide' | 'none' | 'vehicle'
  displayHeight: number
  scale: number
  interactionRadius: number
  prompt: string
  revealPrompt?: string
  platform?: SurfaceDefinition
  platforms?: readonly SurfaceDefinition[]
  groundOrigin?: number
}
/**
 * Furniture type registry and assembled world placements.
 */
export interface FurnitureConfiguration {
  types: Readonly<Record<string, FurnitureDefinition>>
  placements: readonly ObjectPlacement[]
}

/**
 * Reusable NPC artwork, animation and interaction configuration.
 */
export interface NpcDefinition {
  portraitIndex?: number
  portraitBackgroundThreshold?: number
  name: string
  flipX?: boolean
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
  frameSize?: {
    width: number
    height: number
    referenceHeight?: number
  }
  dialogueId?: string
  dialogue?: DialogueDefinition
  schedule?: Partial<Record<DayPhase, NpcSchedulePosition>>
  walk?: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
  run?: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
  attack?: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
  shoot?: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
  death?: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
}

/**
 * NPC definition extended with patrol movement, combat and corpse drops.
 */
export interface PatrolDefinition extends NpcDefinition {
  corpseLoot?: readonly import('../domain/combat/patrolCombat').CorpseDrop[]
  kind?: 'human' | 'monster'
  run: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
  death: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
  attack: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
  combat: PatrolCombatSettings
  walk: {
    key: string
    frameRate: number
    steps: readonly NpcFrame[]
  }
  movement: WanderSettings
}
/**
 * District patrol population, placement bounds and encounter configuration.
 */
export interface PatrolLocation {
  type: string
  counts: Record<DayPhase, number>
  bounds: {
    left: number
    right: number
  }
  scale?: number
  enabled?: boolean
  interiors?: readonly IndoorPatrolLocation[]
  nightEncounters?: readonly {
    type: string
    weight: number
    count: number
  }[]
  outdoorSpawns?: readonly {
    type: string
    counts: Record<DayPhase, number>
    chance: number
    chanceGroup?: string
    shared?: boolean
  }[]
  emptyInteriorSpawn?: {
    type: string
    chance: number
    buildings?: readonly {
      buildingId: string
      chance: number
      types: readonly string[]
    }[]
    excludedRooms?: readonly {
      buildingId: string
      roomId: string
    }[]
  }
}
/**
 * Interior-specific patrol population and placement configuration.
 */
export interface IndoorPatrolLocation extends Omit<PatrolLocation, 'interiors' | 'nightEncounters'> {
  id: string
  buildingId: string
  floor: number
}
/**
 * Assembled patrol type and district population registries.
 */
export interface PatrolConfiguration {
  types: Readonly<Record<string, PatrolDefinition>>
  locations: Readonly<Record<string, PatrolLocation>>
}

/**
 * NPC placement selected for a district and daytime phase.
 */
export interface NpcSchedulePosition {
  locationId: string
  x: number
  buildingId?: string
  roomId?: string
  floor?: number
  scale?: number
  enabled?: boolean
}

/**
 * Reusable container crop, presentation, quality and support geometry.
 */
export interface ContainerType extends Rect {
  sheet?: ContainerConfiguration['sheet']
  name: string
  quality: number
  displayHeight: number
  scale?: number
  groundOrigin?: number
  platform?: SurfaceDefinition
  locked?: boolean
}
/**
 * World placement of a reusable object type with location and interior ownership.
 */
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

/**
 * Placed container with loot, lock, quest and refresh overrides.
 */
export interface ContainerPlacement extends ObjectPlacement {
  restock?: boolean
  developerStock?: boolean
  questId?: string
  questIds?: readonly string[]
  nightOnly?: boolean
  lockRarity?: ItemRarity
  quality?: number
  keyOnly?: boolean
  locked?: boolean
  roomId?: string
  heightOffset?: number
  items?: readonly ItemStack[]
  lootTable?: string
}

/**
 * World placement of a street or interior quest board.
 */
export interface TaskboardPlacement extends ObjectPlacement {
  heightOffset: number
}
/**
 * Quest board artwork and interaction presentation.
 */
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
/**
 * Quest board type registry and assembled world placements.
 */
export interface TaskboardConfiguration {
  types: Readonly<Record<string, TaskboardDefinition>>
  placements: readonly TaskboardPlacement[]
}

/**
 * Container type registry, loot tables, rarity weights and placements.
 */
export interface ContainerConfiguration {
  rarityWeights: Record<ItemRarity, number>
  sheet: {
    sourceKey: string
    textureKey: string
    path: string
    referenceWidth: number
    background?: 'none' | 'light' | 'dark'
  }
  types: Readonly<Record<string, ContainerType>>
  interaction: {
    radius: number
    prompt: string
  }
  lootTables: Readonly<Record<string, {
    minItems: number
    maxItems: number
    itemIds: 'all' | readonly string[]
    rarityWeighted?: boolean
    weights?: Readonly<Record<string, number>>
  }>>
  placements: readonly ContainerPlacement[]
}
