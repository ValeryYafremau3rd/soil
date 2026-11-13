import { vendorItemPool } from '../vendorSeeds.ts'
import { reference,requireCondition,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validateDialogues(context: ContentContext) {
  const { npcs, containers, locations, dialogues, quests, items } = context
for (const [id, definition] of Object.entries(dialogues)) {
    for (const barter of [...definition.barter ? [definition.barter] : [], ...definition.barters ?? []]) {
      const stock = barter.stock
      const path = `dialogues/${id}.json.${barter === definition.barter ? 'barter' : 'barters'}`
      if (barter.requiresQuest) requireCondition(quests.some(quest => quest.id === barter.requiresQuest), `${path}.requiresQuest: unknown quest`)
      requireCondition(barter.items?.length || stock, `${path}: requires items or stock`)
      if (stock) {
        unique(stock.categories, `${path}.stock.categories`)
        for (const category of stock.categories) requireCondition(items.some(item => item.category === category), `${path}.stock.categories: unknown item category "${category}"`)
        const pool = vendorItemPool(stock, items, (barter.items ?? []).map(item => item.itemId))
        requireCondition(stock.minItems <= stock.maxItems && stock.minItems <= pool.length, `${path}.stock: impossible item count`)
        requireCondition(stock.minQuantity <= stock.maxQuantity, `${path}.stock: minQuantity must not exceed maxQuantity`)
      }
      requireCondition(locations.some(location => location.id === barter.locationId), `${path}.locationId: unknown location`)
      for (const stack of barter.items ?? []) requireCondition(items.some(item => item.id === stack.itemId), `${path}.items: unknown item ID "${stack.itemId}"`)
    }
    reference(definition.nodes, definition.start, `dialogues/${id}.json.start`)
    for (const [nodeId, node] of Object.entries(definition.nodes)) {
      unique(node.choices.map(reply => reply.id), `dialogues/${id}.json.nodes.${nodeId}.choices`)
      for (const reply of node.choices) {
        if (reply.requiresQuest) requireCondition(quests.some(quest => quest.id === reply.requiresQuest), `dialogues/${id}.json.${nodeId}.${reply.id}.requiresQuest: unknown quest`)
        if (reply.acceptQuestId) requireCondition(!reply.questId && quests.some(quest => quest.id === reply.acceptQuestId && npcs[quest.offeredBy ?? '']?.dialogueId === id), `dialogues/${id}.json.${nodeId}.${reply.id}.acceptQuestId: unknown NPC offer`)
        if (reply.questId) requireCondition(quests.some(quest => quest.id === reply.questId && (quest.stages.some(stage =>
          stage.trigger.kind === 'dialogue' && stage.trigger.choiceId === reply.id && (npcs[stage.trigger.npcId]?.dialogueId === id
            || ['$source', '$destination'].includes(stage.trigger.npcId) && quest.destinations?.some(destination => npcs[destination.id]?.dialogueId === id)))
          || quest.retryTrigger?.choiceId === reply.id && npcs[quest.retryTrigger.npcId]?.dialogueId === id)),
        `dialogues/${id}.json.${nodeId}.${reply.id}.questId: unknown quest or stage for this NPC`)
        requireCondition([reply.next, reply.close, reply.barter].filter(Boolean).length === 1, `dialogues/${id}.json.${nodeId}.${reply.id}: choose next OR close OR barter`)
        if (reply.barter) requireCondition(reply.barterId ? definition.barters?.some(barter => barter.id === reply.barterId) : definition.barter, `dialogues/${id}.json.${nodeId}.${reply.id}: barter requires stock`)
        if (reply.barterId) requireCondition(reply.barter, `dialogues/${id}.json.${nodeId}.${reply.id}: barterId requires barter`)
        if (reply.next) reference(definition.nodes, reply.next, `dialogues/${id}.json.${nodeId}.${reply.id}.next`)
      }
    }
  }
unique([...containers.placements.map(container => container.id), ...Object.values(dialogues).flatMap(dialogue => dialogue.barter ? [dialogue.barter.id] : [])], 'dialogues.json.barter')
}
