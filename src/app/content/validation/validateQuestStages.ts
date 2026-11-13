import type { QuestDefinition } from '../../../domain/quests/quests'
import { reference,requireCondition } from './assertions.ts'
import type { ContentContext } from './context.ts'
export function validateQuestStages(context: ContentContext, quest: QuestDefinition, path: string): void {
const {buildings,npcs,containers,locations,dialogues,quests,items} = context
const groups = new Set<string>()
for (const [index, stage] of quest.stages.entries()) {
      const stagePath = `${path}.stages[${index}]`
      if (stage.parallelGroup && quest.stages[index - 1]?.parallelGroup !== stage.parallelGroup) {
        requireCondition(!groups.has(stage.parallelGroup), `${stagePath}.parallelGroup: group must be consecutive`)
        groups.add(stage.parallelGroup)
      }
      if (stage.parallelGroup) requireCondition(['dialogue', 'inventory', 'questAccepted', 'room'].includes(stage.trigger.kind) && !stage.deadlinePhases, `${stagePath}.parallelGroup: use dialogue or inventory objectives without individual deadlines`)
      for (const stack of [...stage.requiredItems ?? [], ...stage.removeItems ?? [], ...stage.grantItems ?? []]) {
        requireCondition(stack.itemId === '$item' && quest.findItem === '$item' || items.some(item => item.id === stack.itemId), `${stagePath}: unknown item ID "${stack.itemId}"`)
      }
      for (const group of stage.requiredItemGroups ?? []) {
        requireCondition(group.every(id => items.some(item => item.id === id)), `${stagePath}: unknown group item ID`)
      }
      requireCondition(!stage.removeRequiredItemGroups || stage.requiredItemGroups?.length, `${stagePath}: group removal requires item groups`)
      if (stage.trigger.kind === 'inventory') requireCondition(stage.requiredItems?.length || stage.requiredItemGroups?.length, `${stagePath}: inventory stages require items`)
      else if (stage.trigger.kind === 'location') {
        const locationId = stage.trigger.locationId
        requireCondition(locations.some(location => location.id === locationId), `${stagePath}.trigger.locationId: unknown location`)
      }
      else if (stage.trigger.kind === 'room') {
        const { locationId, buildingId, roomId } = stage.trigger
        const location = locations.find(location => location.id === locationId)
        requireCondition(location?.buildings.some(building => building.id === buildingId
          && buildings[building.type]?.rooms?.some(room => room.id === roomId)), `${stagePath}: unknown room placement`)
      }
      else if (stage.trigger.kind === 'questAccepted') {
        reference(npcs, stage.trigger.npcId, `${stagePath}.trigger.npcId`)
        const npcId = stage.trigger.npcId
        requireCondition(quests.some(candidate => candidate.offeredBy === npcId), `${stagePath}: NPC must offer a quest`)
      }
      else if (stage.trigger.kind === 'accept') requireCondition(index === 0 && quest.stages.length > 1, `${stagePath}: acceptance must be the first stage`)
      else if (stage.trigger.kind === 'loot' || stage.trigger.kind === 'deposit') {
        const { containerId } = stage.trigger
        const targets = containerId === '$source' || containerId === '$destination' ? quest.destinations?.map(destination => destination.containerId) ?? [] : [containerId]
        requireCondition(targets.length > 0 && targets.every(id => containers.placements.some(container => container.id === id
          && ((!container.questId && !container.questIds?.length) || container.questId === quest.id || container.questIds?.includes(quest.id)))),
          `${stagePath}.trigger.containerId: transfer stages require an ordinary container or one gated to this quest`)
        if (stage.trigger.kind === 'deposit') requireCondition(stage.requiredItems?.length && !stage.removeItems?.length && !stage.grantItems?.length, `${stagePath}: deposit stages require transferred items without inventory grants/removals`)
      } else if (stage.trigger.kind === 'dialogue') {
        const { npcId, choiceId } = stage.trigger
        const targets = npcId === '$source' || npcId === '$destination' ? quest.destinations?.map(destination => destination.id) ?? [] : [npcId]
        requireCondition(targets.length > 0, `${stagePath}.trigger.npcId: requires quest destinations`)
        for (const id of targets) {
          reference(npcs, id, `${stagePath}.trigger.npcId`)
          if (npcs[id].dialogueId) reference(dialogues, npcs[id].dialogueId!, `npcs.json.${id}.dialogueId`)
          const dialogue = dialogues[npcs[id].dialogueId ?? '']
          requireCondition(dialogue && Object.values(dialogue.nodes).some(node => node.choices.some(choice => choice.id === choiceId && choice.questId === quest.id)),
            `${stagePath}.trigger.choiceId: NPC must have a matching quest dialogue choice`)
        }
      }
    }
}
