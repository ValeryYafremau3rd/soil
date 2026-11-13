import { reference,requireCondition,surfaces,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'
import { validateLootQuality } from './validateLootQuality.ts'

export function validateRooms(context: ContentContext) {
  const { rooms, furniture, containers, itemIds } = context
for (const [id, room] of Object.entries(rooms)) {
    const path = `rooms.json.${id}`
    requireCondition(room.bounds.left < room.bounds.right && room.bounds.ceiling < room.groundY, `${path}.bounds: invalid room boundaries`)
    if (room.sprite.crop) requireCondition(room.bounds.right <= room.sprite.crop.width * (room.widthScale ?? 1) && room.groundY <= room.sprite.crop.height,
      `${path}: room boundaries exceed sprite crop`)
    surfaces(room.platforms, `${path}.platforms`)
    unique((room.containers ?? []).map(p => p.id), `${path}.containers`)
    for (const p of room.containers ?? []) {
      const containerPath = `${path}.containers.${p.id}`
      reference(containers.types, p.type, `${containerPath}.type`)
      requireCondition(p.x >= room.bounds.left && p.x <= room.bounds.right, `${containerPath}.x: outside room bounds`)
      const type = containers.types[p.type]
      requireCondition((p.heightOffset ?? 0) + type.displayHeight * (type.scale ?? 1) * (p.scale ?? 1)
        <= room.groundY - room.bounds.ceiling, `${containerPath}: container exceeds room height`)
      if (p.lootTable) reference(containers.lootTables, p.lootTable, `${containerPath}.lootTable`)
      validateLootQuality(context)(p.lootTable, p.quality ?? type.quality, containerPath, p.type)
      for (const item of p.items ?? []) requireCondition(itemIds.has(item.itemId), `${containerPath}.items: unknown item ID "${item.itemId}"`)
    }
    unique((room.furniture ?? []).map(p => p.id), `${path}.furniture`)
    for (const p of room.furniture ?? []) {
      reference(furniture.types, p.type, `${path}.furniture.${p.id}.type`)
      const definition = furniture.types[p.type]
      requireCondition(definition.action !== 'hide', `${path}.furniture.${p.id}: cover belongs outdoors`)
      requireCondition(p.x >= room.bounds.left && p.x <= room.bounds.right, `${path}.furniture.${p.id}.x: outside room bounds`)
      requireCondition(definition.displayHeight * definition.scale * (p.scale ?? 1) <= room.groundY - room.bounds.ceiling,
        `${path}.furniture.${p.id}: furniture exceeds room height`)
    }
  }
}
