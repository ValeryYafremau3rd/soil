import type { SurfaceDefinition } from '../../../content/types'
import { requireCondition,surfaces } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validateLoot(context: ContentContext) {
  const { input, containers, itemIds } = context
for (const [id, table] of Object.entries(containers.lootTables)) {
    const pool = table.itemIds === 'all' ? [...itemIds] : table.itemIds
    requireCondition(table.minItems <= table.maxItems && table.minItems <= new Set(pool).size,
      `containers.json.lootTables.${id}: impossible item count`)
    for (const itemId of pool) requireCondition(itemIds.has(itemId), `containers.json.lootTables.${id}: unknown item ID "${itemId}"`)
  }
for (const [id, type] of Object.entries(containers.types)) {
    if (type.platform) surfaces([type.platform], `containers.json.types.${id}.platform`)
  }
surfaces((input.settings as { busStop: { platforms?: SurfaceDefinition[] } }).busStop.platforms, 'settings.json.busStop.platforms')
}
