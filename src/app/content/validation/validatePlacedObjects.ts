import { reference,requireCondition,surfaces,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'
import { validateLootQuality } from './validateLootQuality.ts'
import { validatePlacement } from './validatePlacement.ts'

export function validatePlacedObjects(context: ContentContext) {
  const { buildings, furniture, containers, locations, itemIds } = context
unique(containers.placements.map(container => container.id), 'containers.json.placements')
for (const [id, definition] of Object.entries(furniture.types)) {
    if (definition.action === 'hide') requireCondition(definition.revealPrompt, `furniture.json.types.${id}.revealPrompt: required for cover`)
    if (definition.platform) surfaces([definition.platform], `furniture.json.types.${id}.platform`)
    surfaces(definition.platforms, `furniture.json.types.${id}.platforms`)
  }
unique(furniture.placements.map(p => p.id), 'furniture.json.placements')
for (const p of furniture.placements) {
    const path = `furniture.json.placements.${p.id}`
    reference(furniture.types, p.type, `${path}.type`)
    validatePlacement(context)(p, path)
    const action = furniture.types[p.type].action
    requireCondition(action !== 'hide' || p.space === 'outside', `${path}: cover belongs outdoors`)
    requireCondition(action !== 'sleep' || p.space === 'inside', `${path}: beds belong indoors`)
  }
for (const placement of containers.placements) {
    const path = `containers.json.placements.${placement.id}`
    reference(containers.types, placement.type, `${path}.type`)
    validatePlacement(context)(placement, path)
    if (placement.roomId) {
      const location = locations.find(candidate => candidate.id === placement.locationId)
      const instance = location?.buildings.find(candidate => candidate.id === placement.buildingId)
      const room = instance && buildings[instance.type].rooms?.find(candidate => candidate.id === placement.roomId)
      requireCondition(placement.space === 'inside' && room && room.floor === (placement.floor ?? 0), `${path}.roomId: unknown room or incorrect floor`)
    }
    if (placement.lootTable) reference(containers.lootTables, placement.lootTable, `${path}.lootTable`)
    validateLootQuality(context)(placement.lootTable, placement.quality ?? containers.types[placement.type].quality, path, placement.type)
    for (const item of placement.items ?? []) requireCondition(itemIds.has(item.itemId), `${path}.items: unknown item ID "${item.itemId}"`)
  }
}
