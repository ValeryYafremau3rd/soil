import type { ItemStack } from '../inventory/loot'
import skillConfig from '../../content/skills.json' with { type: 'json' }
import type { InventoryItemDefinition, ItemRarity } from '../inventory/items'

export interface QuestStage {
  parallelGroup?: string
  phases?: readonly string[]
  deadlinePhases?: number
  id: string
  description: string
  trigger: { kind: 'location'; locationId: string } | { kind: 'room'; locationId: string; buildingId: string; roomId: string } | { kind: 'questAccepted'; npcId: string } | { kind: 'dialogue'; npcId: string; choiceId: string } | { kind: 'inventory' } | { kind: 'accept' } | { kind: 'pending' } | { kind: 'loot'; containerId: string } | { kind: 'deposit'; containerId: string }
  requiredItems?: readonly ItemStack[]
  requiredItemGroups?: readonly (readonly string[])[]
  removeRequiredItemGroups?: boolean
  removeItems?: readonly ItemStack[]
  grantItems?: readonly ItemStack[]
}
export interface QuestParameters { sourceId: string; destinationId: string; itemId?: string }
export interface QuestDestination { id: string; name: string; containerId?: string }
export interface QuestDefinition { destinations?: readonly QuestDestination[]; deliveryKind?: 'courier' | 'smuggler'; deliveryItemId?: string; autoStart?: boolean; id: string; name: string; description: string; retryTrigger?: { npcId: string; choiceId: string }; retryStage?: number; repeatable?: boolean; findItem?: string; findItemOptions?: readonly (InventoryItemDefinition & { name: string })[]; prerequisites?: readonly string[]; offeredBy?: string; offerText?: string; stages: readonly QuestStage[]; reward?: { items?: readonly ItemStack[]; money?: number } }
export interface QuestProgress { parameters?: QuestParameters; questId: string; stageIndex: number; completedStageIds?: readonly string[]; deadline?: number; failed?: boolean }
export interface CourierBoard { parameters?: Readonly<Record<string, QuestParameters>>; day: number; offeredQuestIds: readonly string[]; acceptedQuestIds: readonly string[] }

/** Resolve find requests from current authored item prices, never vendor/Barter sale prices. */
export function resolveFindItemRewards(quests: readonly QuestDefinition[], items: readonly InventoryItemDefinition[],
  multipliers: Readonly<Record<ItemRarity, number>>): QuestDefinition[] {
  return quests.map(quest => {
    if (!quest.findItem || quest.findItem === '$item') return quest
    const item = items.find(item => item.id === quest.findItem)
    if (!item || !item.price || !item.rarity) throw new Error(`Invalid find-item request: ${quest.id}`)
    return { ...quest, reward: { money: Math.ceil(item.price * multipliers[item.rarity]) } }
  })
}

export function isQuestCompleted(id: string, progress: readonly QuestProgress[], definitions: readonly QuestDefinition[]): boolean {
  const definition = definitions.find(quest => quest.id === id)
  return !!definition && progress.some(entry => entry.questId === id && entry.stageIndex >= definition.stages.length)
}

/** Derive trust from current persuasion and finished story quests, including older saves. */
export function npcTrust(npcId: string, progress: readonly QuestProgress[], definitions: readonly QuestDefinition[], persuasion = 0): number {
  if (!npcId) return 0
  const bonus = Math.floor(Math.max(0, persuasion) / skillConfig.persuasionTrustPoints)
  return Math.min(5, 1 + bonus + new Set(definitions.filter(quest => {
    if (quest.repeatable || !isQuestCompleted(quest.id, progress, definitions)) return false
    const recipient = quest.stages.findLast(stage => stage.trigger.kind === 'dialogue')?.trigger
    return (quest.offeredBy ?? (recipient?.kind === 'dialogue' ? recipient.npcId : undefined)) === npcId
  }).map(quest => quest.id)).size)
}

export function isQuestAvailable(quest: QuestDefinition, progress: readonly QuestProgress[], board: CourierBoard, definitions: readonly QuestDefinition[] = []): boolean {
  if (quest.deliveryKind && definitions.some(other => other.id !== quest.id && other.deliveryKind === quest.deliveryKind
    && progress.some(entry => entry.questId === other.id && !entry.failed && entry.stageIndex < other.stages.length))) return false
  if (quest.prerequisites?.some(id => !isQuestCompleted(id, progress, definitions))) return false
  const current = progress.find(entry => entry.questId === quest.id)
  if (!quest.repeatable) return !current
  return board.offeredQuestIds.includes(quest.id) && !board.acceptedQuestIds.includes(quest.id)
    && (!current || current.failed || current.stageIndex >= quest.stages.length)
}

/** Share the board offer limit between presentation and acceptance. */
export function availableBoardQuests(definitions: readonly QuestDefinition[], progress: readonly QuestProgress[], board: CourierBoard,
  findItemMaxPrice: number): QuestDefinition[] {
  const activeRequest = definitions.some(quest => quest.findItem && progress.some(entry => entry.questId === quest.id
    && entry.stageIndex < quest.stages.length));
  let courierOffered = definitions.some(quest => quest.deliveryKind === 'courier' && progress.some(entry => entry.questId === quest.id && !entry.failed && entry.stageIndex < quest.stages.length));
  let requestOffered = activeRequest;
  return definitions.filter(quest => {
    if (quest.autoStart || quest.offeredBy || !isQuestAvailable(quest, progress, board, definitions)) return false;
    if (quest.deliveryKind === 'courier') {
      if (courierOffered) return false;
      courierOffered = true;
    }
    if (!quest.findItem) return true;
    if (requestOffered || !quest.reward?.money || quest.reward.money > findItemMaxPrice * 2) return false;
    requestOffered = true;
    return true;
  });
}
export function hasQuestItems(items: readonly ItemStack[], required: readonly ItemStack[] = []): boolean {
  const quantities = new Map<string, number>()
  for (const stack of required) quantities.set(stack.itemId, (quantities.get(stack.itemId) ?? 0) + stack.quantity)
  return [...quantities].every(([id, quantity]) => items.reduce((total, stack) => total + (stack.itemId === id ? stack.quantity : 0), 0) >= quantity)
}

export function canCompleteStage(stage: QuestStage, items: readonly ItemStack[]): boolean {
  return hasQuestItems(items, stage.requiredItems) && hasQuestItems(items, stage.removeItems)
    && selectQuestGroupItems(stage, items) !== null
}

/** Select one carried unit per alternative group, without reusing a unit. */
export function selectQuestGroupItems(stage: QuestStage, items: readonly ItemStack[]): ItemStack[] | null {
  const remaining = items.map(stack => ({ ...stack }))
  const selected: ItemStack[] = []
  for (const group of stage.requiredItemGroups ?? []) {
    const stack = remaining.find(stack => stack.quantity > 0 && group.includes(stack.itemId))
    if (!stack) return null
    stack.quantity--
    selected.push({ itemId: stack.itemId, quantity: 1 })
  }
  return selected
}

/** Consecutive stages in one group are available together until every objective is done. */
export function activeQuestStages(definition: QuestDefinition, progress: QuestProgress): readonly QuestStage[] {
  if (progress.failed) return []
  const first = definition.stages[progress.stageIndex]
  if (!first) return []
  let end = progress.stageIndex + 1
  if (first.parallelGroup) while (definition.stages[end]?.parallelGroup === first.parallelGroup) end++
  const stages = definition.stages.slice(progress.stageIndex, end)
  return stages.filter(stage => !progress.completedStageIds?.includes(stage.id))
}

/** Resolve one generic delivery template using the parameters saved with its offer/run. */
export function resolveQuest(quest: QuestDefinition, route?: QuestParameters): QuestDefinition {
  if (!route || !quest.destinations) return quest
  const source = quest.destinations.find(destination => destination.id === route.sourceId)
  const destination = quest.destinations.find(destination => destination.id === route.destinationId)
  if (!source || !destination || !quest.findItem && source.id === destination.id) return quest
  const item = quest.findItemOptions?.find(item => item.id === route.itemId)
  const text = (value: string) => value.replaceAll('{source}', source.name).replaceAll('{destination}', destination.name).replaceAll('{item}', item?.name ?? '')
  const stacks = (items: readonly ItemStack[] | undefined) => items?.map(stack => ({ ...stack, itemId: stack.itemId === '$item' ? item?.id ?? '$item' : stack.itemId }))
  const npc = (id: string) => id === '$source' ? source.id : id === '$destination' ? destination.id : id
  const container = (id: string) => id === '$source' ? source.containerId! : id === '$destination' ? destination.containerId! : id
  return { ...quest, ...(quest.findItem === '$item' && item ? { findItem: item.id } : {}), name: text(quest.name), description: text(quest.description), ...(quest.offerText ? { offerText: text(quest.offerText) } : {}),
    stages: quest.stages.map(stage => ({ ...stage, description: text(stage.description), ...(stage.requiredItems ? { requiredItems: stacks(stage.requiredItems) } : {}), ...(stage.removeItems ? { removeItems: stacks(stage.removeItems) } : {}), trigger: stage.trigger.kind === 'dialogue'
      ? { ...stage.trigger, npcId: npc(stage.trigger.npcId) }
      : stage.trigger.kind === 'loot' || stage.trigger.kind === 'deposit' ? { ...stage.trigger, containerId: container(stage.trigger.containerId) } : stage.trigger })) }
}
