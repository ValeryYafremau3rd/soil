import type { QuestAction, CourierBoard, QuestDefinition, QuestProgress } from '../../domain/quests/quests'

/**
 * Observable quest state exposed to service subscribers.
 */
export interface QuestSnapshot {
  readonly boardOpen: boolean
  readonly progress: readonly QuestProgress[]
  readonly courierBoard: CourierBoard
  readonly npcJobs: CourierBoard
}
/**
 * Typed quest actions and queries exposed across application layers.
 */
export interface QuestController {
  readonly definitions: readonly QuestDefinition[]
  getSnapshot(): QuestSnapshot
  subscribe(listener: () => void): () => void
  getBoardQuests(): readonly QuestDefinition[]
  recordAction(action: QuestAction, itemId?: string): void
  visitRoom(locationId: string, buildingId: string, roomId: string): void
  visitLocation(locationId: string): void
  openBoard(): void
  closeBoard(): void
  accept(questId: string): void
  startForTesting(questId: string): boolean
  isCompleted(questId: string): boolean
  getTrust(npcId: string): number
  isActive(questId: string): boolean
  canTakeDeliveryItem(containerId: string, itemId: string): boolean | string
  canOffer(questId: string, npcId: string): boolean
  acceptFromNpc(questId: string, npcId: string): boolean
  getOffer(npcId: string): string | null
  canAdvanceDialogue(questId: string, npcId: string, choiceId: string): boolean
  advanceDialogue(questId: string, npcId: string, choiceId: string): boolean
  interactWorld(interactionId: string): boolean
  completeEscape(route: 'illegal' | 'official'): boolean
}
