import type { ItemStack } from '../../inventory/loot'
import type { InventoryItemDefinition } from '../../inventory/items'

export type QuestAction = 'buy' | 'consume' | 'bus' | 'rest' | 'sleep'
  | 'workAsked' | 'gunDefeat' | 'meleeDefeat' | 'chaseHidden' | 'objectHidden'

/**
 * One quest objective, including its trigger, required items and grants.
 */
export interface QuestStage {
  collectedFrom?: string
  worldInteraction?: string
  parallelGroup?: string
  phases?: readonly string[]
  deadlinePhases?: number
  id: string
  description: string
  trigger:
  {
    kind: 'action'
    action: QuestAction
    itemIds?: readonly string[]
  } |
  {
    kind: 'location'
    locationId: string
  } |
  {
    kind: 'room'
    locationId: string
    buildingId: string
    roomId: string
  } |
  {
    kind: 'questAccepted'
    npcId: string
  } |
  {
    kind: 'dialogue'
    npcId: string
    choiceId: string
  } |
  {
    kind: 'inventory'
  } |
  {
    kind: 'accept'
  } |
  {
    kind: 'pending'
  } |
  {
    kind: 'loot'
    containerId: string
  } |
  {
    kind: 'deposit'
    containerId: string
  }
  requiredItems?: readonly ItemStack[]
  requiredItemGroups?: readonly (readonly string[])[]
  removeRequiredItemGroups?: boolean
  removeItems?: readonly ItemStack[]
  grantItems?: readonly ItemStack[]
}

/**
 * Saved source, destination and item identifiers for a generated quest run.
 */
export interface QuestParameters {
  sourceId: string
  destinationId: string
  itemId?: string
}

/**
 * Named NPC destination and optional shipment container for quest templates.
 */
export interface QuestDestination {
  id: string
  name: string
  containerId?: string
}

/**
 * Authored quest template, prerequisites, stages and completion rewards.
 */
export interface QuestDefinition {
  destinations?: readonly QuestDestination[]
  deliveryKind?: 'courier' | 'smuggler'
  deliveryItemId?: string
  morningStart?: boolean
  autoStart?: boolean
  id: string
  name: string
  description: string
  retryTrigger?: {
    npcId: string
    choiceId: string
  }
  retryStage?: number
  repeatable?: boolean
  findItem?: string
  findItemOptions?: readonly (InventoryItemDefinition & {
    name: string
  })[]
  prerequisites?: readonly string[]
  offeredBy?: string
  offerText?: string
  stages: readonly QuestStage[]
  reward?: {
    items?: readonly ItemStack[]
    money?: number
  }
}

/**
 * Persisted progress for one quest run, including parallel objectives and deadlines.
 */
export interface QuestProgress {
  parameters?: QuestParameters
  questId: string
  stageIndex: number
  /** Day this run finished; absent in older saves. */
  completedDay?: number
  completedStageIds?: readonly string[]
  deadline?: number
  failed?: boolean
}

/**
 * Daily offer and acceptance ledger with parameters for generated jobs.
 */
export interface CourierBoard {
  parameters?: Readonly<Record<string, QuestParameters>>
  day: number
  offeredQuestIds: readonly string[]
  acceptedQuestIds: readonly string[]
}
