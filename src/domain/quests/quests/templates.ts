import type { ItemStack } from '../../inventory/loot'
import type { QuestDefinition, QuestParameters } from './types'

/**
 * Resolve one generic delivery template using the parameters saved with its offer/run.
 * @param {QuestDefinition} quest - The quest supplied to this operation.
 * @param {QuestParameters | undefined} route - The route supplied to this operation.
 * @returns {QuestDefinition} The result described by the TypeScript return signature.
 */
export function resolveQuest(
  quest: QuestDefinition,
  route?: QuestParameters
): QuestDefinition {
  if (!route || !quest.destinations) return quest

  const source = quest.destinations.find(destination => destination.id === route.sourceId)
  const destination = quest.destinations.find(destination => destination.id === route.destinationId)
  if (!source || !destination || !quest.findItem && source.id === destination.id) return quest

  const item = quest.findItemOptions?.find(item => item.id === route.itemId)

  /**
   * Perform text.
   * @param {string} value - The value supplied to this operation.
   * @returns {string} The resolved text value.
   */
  const text = (value: string) => value.replaceAll('{source}', source.name).replaceAll('{destination}', destination.name).replaceAll(
    '{item}',
    item?.name ?? ''
  )

  /**
   * Perform stacks.
   * @param {readonly ItemStack[] | undefined} items - Item stacks to inspect or transform.
   * @returns {{ itemId: string; quantity: number; }[] | undefined} The result described by the TypeScript return signature.
   */
  const stacks = (items: readonly ItemStack[] | undefined) => items?.map(stack => ({ ...stack, itemId: stack.itemId === '$item' ? item?.id ?? '$item' : stack.itemId }))

  /**
   * Perform npc.
   * @param {string} id - The id supplied to this operation.
   * @returns {string} The resolved text value.
   */
  const npc = (id: string) => id === '$source' ? source.id : id === '$destination' ? destination.id : id

  /**
   * Perform container.
   * @param {string} id - The id supplied to this operation.
   * @returns {string} The resolved text value.
   */
  const container = (id: string) => id === '$source' ? source.containerId! : id === '$destination' ? destination.containerId! : id

  return {
    ...quest,
    ...(quest.findItem === '$item' && item ? { findItem: item.id } : {}),
    name: text(quest.name),
    description: text(quest.description),
    ...(quest.offerText ? { offerText: text(quest.offerText) } : {}),
    stages: quest.stages.map(stage => ({
      ...stage,
      description: text(stage.description),
      ...(stage.requiredItems ? { requiredItems: stacks(stage.requiredItems) } : {}),
      ...(stage.removeItems ? { removeItems: stacks(stage.removeItems) } : {}),
      trigger: stage.trigger.kind === 'dialogue'
        ? { ...stage.trigger, npcId: npc(stage.trigger.npcId) }
        : stage.trigger.kind === 'loot' || stage.trigger.kind === 'deposit' ? { ...stage.trigger, containerId: container(stage.trigger.containerId) } : stage.trigger
    }))
  }
}
