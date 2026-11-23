import type { ContainerConfiguration } from '../../content/types'
import type { InventoryItemDefinition } from '../../domain/inventory/items'
import { ITEM_RARITIES, itemHasStats } from '../../domain/inventory/items.ts'

/**
 * Perform build container seeds.
 * @param {ContainerConfiguration} config - Configuration consumed by this operation.
 * @param {readonly (string | InventoryItemDefinition)[]} items - Item stacks to inspect or transform.
 * @returns {object} The result described by the TypeScript return signature.
 */
export function buildContainerSeeds(
  config: ContainerConfiguration,
  items: readonly (string | InventoryItemDefinition)[]
) {
  const definitions: readonly InventoryItemDefinition[] = items.map(item => typeof item === 'string' ? { id: item, rarity: 'common' as const } : item)
  const itemIds = definitions.filter(item => item.randomLoot !== false).map(item => item.id)
  const byId = new Map(definitions.map(item => [item.id, item]))

  return config.placements.filter(placement => placement.enabled !== false).map(placement => {
    const table = placement.lootTable ? config.lootTables[placement.lootTable] : undefined
    if (placement.lootTable && !table) throw new Error(`Container ${placement.id}: unknown loot table ${placement.lootTable}`)

    const quality = placement.quality ?? config.types[placement.type]?.quality ?? 1
    const refreshTable = placement.restock === false && placement.items?.length && !placement.lootTable
      && !placement.keyOnly && !placement.developerStock && !placement.questId && !placement.questIds?.length
      ? config.lootTables['rarity-scavenge'] : undefined
    const refreshPool = (refreshTable?.itemIds === 'all' ? itemIds : refreshTable?.itemIds ?? [])
      .filter(id => byId.get(id)?.randomLoot !== false && (byId.get(id)?.quality ?? 1) <= quality
        && (placement.type !== 'trash' || !byId.get(id) || !itemHasStats(byId.get(id)!)))
    const pool = (table?.itemIds === 'all' ? itemIds : table?.itemIds ?? []).filter(id => {
      const item = byId.get(id)
      const permanentBuff = item && !item.consumable && (item.bonus || item.bonuses?.length || item.damageResistance || item.fearResistance || item.stealthModifier)

      return (item?.quality ?? 1) <= quality && (placement.restock === false || !permanentBuff)
        && (placement.type !== 'trash' || !item || !itemHasStats(item))
    })

    return {
      id: placement.id,
      locationId: placement.locationId,
      name: config.types[placement.type]?.name ?? placement.type,
      space: placement.space,
      restock: placement.developerStock ? false : placement.restock,
      questId: placement.questId,
      questIds: placement.questIds,
      nightOnly: placement.nightOnly,
      lockRarity: placement.lockRarity,
      quality,
      keyOnly: placement.keyOnly,
      refreshLoot: refreshTable ? {
        minItems: refreshTable.minItems,
        maxItems: refreshTable.maxItems,
        itemIds: refreshPool,
        weights: Object.fromEntries(refreshPool.map(id => [
          id,
          config.rarityWeights[byId.get(id)?.rarity ?? 'common']
            * quality ** ITEM_RARITIES.indexOf(byId.get(id)?.rarity ?? 'common')
            * (refreshTable.weights?.[id] ?? 1),
        ]))
      } : undefined,
      items: placement.developerStock ? definitions.map(item => ({ itemId: item.id, quantity: item.maxStack ?? 1 })) : placement.items ?? [],
      locked: placement.locked ?? config.types[placement.type]?.locked ?? false,
      loot: table ? {
        minItems: table.minItems,
        maxItems: table.maxItems,
        itemIds: pool,
        weights: table.weights || table.rarityWeighted || placement.quality !== undefined || config.types[placement.type]?.quality !== undefined ? Object.fromEntries(pool.map(id => [
          id,
          config.rarityWeights[byId.get(id)?.rarity ?? 'common']
            * quality ** ITEM_RARITIES.indexOf(byId.get(id)?.rarity ?? 'common')
            * (table.weights?.[id] ?? 1),
        ])) : undefined
      } : undefined,
    }
  })
}
