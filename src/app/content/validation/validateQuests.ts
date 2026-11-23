import { ITEM_RARITIES } from '../../../domain/inventory/items.ts'
import type { QuestStage } from '../../../domain/quests/quests'
import { reference, requireCondition, unique } from './assertions.ts'
import type { ContentContext } from './context.ts'
import { validateQuestStages } from './validateQuestStages.ts'

/**
 * Validate quests against the supported rules.
 * @param {object} context - The context supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateQuests(context: ContentContext) {
  const { npcs, containers, locations, dialogues, quests, items, lockSums } = context
  unique(quests.map(quest => quest.id), 'quests.json')

  /**
   * Perform visit quest.
   * @param {string} id - The id supplied to this operation.
   * @param {Set<string>} visiting - The visiting supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const visitQuest = (
    id: string,
    visiting: Set<string>
  ): void => {
    requireCondition(!visiting.has(id), `quests.json.${id}.prerequisites: cyclic quest chain`)
    const quest = quests.find(quest => quest.id === id)
    requireCondition(quest, `quests.json.${id}.prerequisites: unknown quest`)

    for (const prerequisite of quest.prerequisites ?? []) visitQuest(prerequisite, new Set([...visiting, id]))
  }

  for (const quest of quests) visitQuest(quest.id, new Set())

  requireCondition(
    ITEM_RARITIES.every((rarity, index) => !index || lockSums[ITEM_RARITIES[index - 1]] <= lockSums[rarity]),
    'skills.json.lockpickingMaxSumByRarity: difficulty must increase with rarity'
  )

  for (const container of containers.placements) if (container.questId) requireCondition(
    quests.some(quest => quest.id === container.questId),
    `containers.json.placements.${container.id}.questId: unknown quest`
  )

  for (const container of containers.placements) for (const id of container.questIds ?? []) requireCondition(
    quests.some(quest => quest.id === id),
    `containers.json.placements.${container.id}.questIds: unknown quest`
  )

  for (const quest of quests) {
    const path = `quests.json.${quest.id}`
    if (quest.deliveryItemId) requireCondition(
      items.some(item => item.id === quest.deliveryItemId && item.category === 'Quest' && item.saleable === false && item.randomLoot === false),
      `${path}.deliveryItemId: requires a protected delivery parcel`
    )

    unique(quest.prerequisites ?? [], `${path}.prerequisites`)
    if (quest.offeredBy) {
      reference(npcs, quest.offeredBy, `${path}.offeredBy`)
      const dialogue = dialogues[npcs[quest.offeredBy].dialogueId ?? '']
      requireCondition(
        dialogue && Object.values(dialogue.nodes).some(node => node.choices.some(choice => choice.acceptQuestId === quest.id)),
        `${path}.offeredBy: missing NPC offer choice`
      )
    }

    if (quest.destinations) {
      requireCondition(
        quest.destinations.length >= 2,
        `${path}.destinations: requires at least two destinations`
      )
      unique(quest.destinations.map(destination => destination.id), `${path}.destinations`)

      for (const destination of quest.destinations) {
        if (quest.deliveryKind === 'smuggler') requireCondition(
          locations.some(location => location.id === destination.id)
          && containers.placements.some(container => container.id === destination.containerId && container.locationId === destination.id && container.type === 'smuggler-crate'),
          `${path}.destinations: requires each location's shipment crate`
        )
        else reference(npcs, destination.id, `${path}.destinations`)
      }
    }

    if (quest.findItem) {
      const generic = quest.findItem === '$item'
      const requested = generic ? quest.findItemOptions ?? [] : items.filter(item => item.id === quest.findItem)
      requireCondition(
        requested.length > 0 && requested.every(option => items.some(item => item.id === option.id && (item.price ?? 0) > 0 && item.saleable !== false && item.category !== 'Quest' && !item.keys)),
        `${path}.findItem: requires saleable items with positive prices`
      )
      requireCondition(
        !quest.reward,
        `${path}.reward: find-item payment is calculated from item price and rarity`
      )
      const stage = quest.stages.at(-1)!

      /**
       * Perform matches.
       * @param {readonly ItemStack[] | undefined} stacks - The stacks supplied to this operation.
       * @returns {boolean} Whether the requested condition is satisfied.
       */
      const matches = (stacks: QuestStage['requiredItems']) => stacks?.length === 1 && stacks[0].itemId === quest.findItem && stacks[0].quantity === 1
      requireCondition(
        quest.stages.length === (generic ? 2 : 1) && stage.trigger.kind === 'dialogue' && matches(stage.requiredItems)
        && matches(stage.removeItems) && !stage.grantItems?.length && (!generic || quest.destinations && quest.repeatable),
        `${path}.stages: find-item requests must hand one requested item to an NPC`
      )
    }

    if (quest.reward) requireCondition(
      (quest.reward.items?.length ?? 0) > 0 || (quest.reward.money ?? 0) > 0,
      `${path}.reward: requires items or money`
    )

    for (const stack of quest.reward?.items ?? []) requireCondition(
      items.some(item => item.id === stack.itemId),
      `${path}.reward.items: unknown item ID "${stack.itemId}"`
    )

    unique(quest.stages.map(stage => stage.id), `${path}.stages`)
    if (quest.retryStage !== undefined) {
      requireCondition(
        quest.retryStage > 0 && quest.retryStage < quest.stages.length && (quest.retryTrigger || quest.stages[0].trigger.kind === 'dialogue'),
        `${path}.retryStage: requires a valid restart stage and retry dialogue`
      )
    }

    if (quest.stages.some(stage => stage.deadlinePhases !== undefined)) requireCondition(
      quest.retryStage !== undefined || quest.repeatable && quest.deliveryKind,
      `${path}: timed quests require a restart stage or repeatable delivery`
    )

    if (quest.retryTrigger) {
      const { npcId, choiceId } = quest.retryTrigger
      reference(npcs, npcId, `${path}.retryTrigger.npcId`)
      const dialogue = dialogues[npcs[npcId].dialogueId ?? '']
      requireCondition(
        dialogue && Object.values(dialogue.nodes).some(node => node.choices.some(reply => reply.id === choiceId && reply.questId === quest.id)),
        `${path}.retryTrigger: missing retry dialogue choice`
      )
    }

    validateQuestStages(context, quest, path)
  }
}
