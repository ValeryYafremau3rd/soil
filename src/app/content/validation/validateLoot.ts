import type { SurfaceDefinition } from '../../../content/types'
import { requireCondition, surfaces } from './assertions.ts'
import type { ContentContext } from './context.ts'

/**
 * Validate loot against the supported rules.
 * @param {object} context - The context supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateLoot(context: ContentContext) {
  const { input, containers, itemIds } = context

  for (const [id, table] of Object.entries(containers.lootTables)) {
    const pool = table.itemIds === 'all' ? [...itemIds] : table.itemIds
    for (const weightedId of Object.keys(table.weights ?? {})) requireCondition(
      itemIds.has(weightedId),
      `containers.json.lootTables.${id}.weights: unknown item ID "${weightedId}"`,
    )
    requireCondition(table.minItems <= table.maxItems && table.minItems <= new Set(pool).size,
      `containers.json.lootTables.${id}: impossible item count`)

    for (const itemId of pool) requireCondition(
      itemIds.has(itemId),
      `containers.json.lootTables.${id}: unknown item ID "${itemId}"`
    )
  }

  for (const [id, type] of Object.entries(containers.types)) {
    if (type.platform) surfaces([type.platform], `containers.json.types.${id}.platform`)
  }

  surfaces(
    (input.settings as {
      busStop: {
        platforms?: SurfaceDefinition[]
      }
    }).busStop.platforms,
    'settings.json.busStop.platforms'
  )
}
