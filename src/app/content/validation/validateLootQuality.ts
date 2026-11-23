import { itemHasStats } from '../../../domain/inventory/items.ts'
import { requireCondition } from './assertions.ts'
import type { ContentContext } from './context.ts'

/**
 * Validate loot quality against the supported rules.
 * @param {object} context - The context supplied to this operation.
 * @returns {(lootTableId: string | undefined, quality: number, path: string, type?: string | undefined) => void} Callback that releases or performs the registered operation.
 */
export function validateLootQuality(context: ContentContext) {
  const { containers, items } = context

  return function validateLootQuality(
    lootTableId: string | undefined,
    quality: number,
    path: string,
    type?: string
  ): void {
    if (!lootTableId) return

    const table = containers.lootTables[lootTableId]
    if (!table) return

    const eligible = items.filter(item => item.quality <= quality && (type !== 'trash' || !itemHasStats(item)) && (table.itemIds === 'all'
      ? item.randomLoot !== false : table.itemIds.includes(item.id)))
    requireCondition(
      eligible.length >= table.minItems,
      `${path}.quality: not enough eligible items for the loot table at quality ${quality}`
    )
  }
}
