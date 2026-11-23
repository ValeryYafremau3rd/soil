import type { DayPhase } from '../contracts/daytime'
import type { TravelLocation } from '../contracts/travel'
import type { BuildingDefinition, NpcDefinition, RoomDefinition } from '../../content/types'
import type { DialogueDefinition, DialogueNode } from '../../domain/dialogue/dialogue'
import { resolveNpcPlacements } from './resolveNpcPlacements.ts'

const PREFIX = '$npc-directions:'

/**
 * Use the same placement rules as the world, including disabled and fallback placements.
 * @param {DialogueDefinition} definition - The definition supplied to this operation.
 * @param {DialogueDefinition} template - The template supplied to this operation.
 * @param {Readonly<Record<string, NpcDefinition>>} npcs - The npcs supplied to this operation.
 * @param {readonly TravelLocation[]} locations - The locations supplied to this operation.
 * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
 * @param {Readonly<Record<string, BuildingDefinition>>} buildings - The buildings supplied to this operation.
 * @param {Readonly<Record<string, RoomDefinition>>} rooms - The rooms supplied to this operation.
 * @param {readonly string[]} absentNpcIds - NPCs suppressed by persistent story consequences.
 * @returns {DialogueDefinition} The result described by the TypeScript return signature.
 */
export function withNpcDirections(
  definition: DialogueDefinition,
  template: DialogueDefinition,
  npcs: Readonly<Record<string, NpcDefinition>>,
  locations: readonly TravelLocation[],
  phase: DayPhase,
  buildings: Readonly<Record<string, BuildingDefinition>>,
  rooms: Readonly<Record<string, RoomDefinition>>,
  absentNpcIds: readonly string[] = [],
): DialogueDefinition {
  const listId = `${PREFIX}list`
  const nodes: Record<string, DialogueNode> = { ...definition.nodes }

  /**
   * Perform format.
   * @param {string} text - The text supplied to this operation.
   * @param {Record<string, string>} values - The values supplied to this operation.
   * @returns {string} The resolved text value.
   */
  const format = (
    text: string,
    values: Record<string, string>
  ) => text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
  const placements = locations.flatMap(location => resolveNpcPlacements(npcs, locations, location.id, phase)
    .map(placement => ({ location, placement })))
  const choices = Object.entries(npcs).map(([id, npc]) => {
    const found = placements.find(entry => entry.placement.type === id && !absentNpcIds.includes(id))
    const building = found && buildings[found.location.buildings.find(entry => entry.id === found.placement.buildingId)?.type ?? '']
    const room = building?.rooms?.find(entry => entry.id === found?.placement.roomId)
    const values = {
      name: npc.name,
      location: found?.location.name ?? '',
      building: building?.name ?? '',
      room: rooms[room?.type ?? '']?.name ?? '',
      floor: String(found?.placement.floor ?? room?.floor ?? 0)
    }
    const response = template.nodes[!found ? 'unavailable' : room ? 'room' : building ? 'building' : 'outdoors']
    const nodeId = `${PREFIX}${id}`
    nodes[nodeId] = {
      text: format(response.text, values),
      choices: response.choices.map(choice => ({ ...choice, next: listId }))
    }

    return { id: nodeId, text: npc.name, next: nodeId }
  })
  nodes[listId] = {
    text: template.nodes.list.text,
    choices: [...choices,
    ...template.nodes.list.choices.map(choice => ({ ...choice, next: definition.start }))]
  }
  const start = nodes[definition.start]
  nodes[definition.start] = {
    ...start, choices: [...start.choices,
    { id: listId, text: template.nodes[template.start].text, next: listId }]
  }

  return { ...definition, nodes }
}
