import { readingItemId } from '../../domain/inventory/reading.ts'
import type { SavedInventory, SaveGame } from '../contracts/save'
import type { ItemStack } from '../../domain/inventory/loot'

/**
 * Perform migrate stacks.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @returns {ItemStack[]} The result described by the TypeScript return signature.
 */
const migrateStacks = (items: readonly ItemStack[]): ItemStack[] => items.map(item => ({ ...item, itemId: readingItemId(item.itemId) }))

/**
 * Perform unique sources.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
const uniqueSources = (items: readonly ItemStack[]): boolean => new Set(items.map(item => item.itemId)).size === items.length

/**
 * Preserve every physical copy, while merging deposit counters and learned identities.
 * @param {SavedInventory} saved - The saved supplied to this operation.
 * @returns {SavedInventory} The result described by the TypeScript return signature.
 */
export function migrateReadingInventory(saved: SavedInventory): SavedInventory {
  const deposits = Object.fromEntries(Object.entries(saved.deposits).map(([id, items]) => {
    // Merge aliases from different old books, but leave malformed duplicate counters for validation.
    if (!uniqueSources(items)) return [id, migrateStacks(items)]

    const totals = new Map<string, number>()

    for (const item of migrateStacks(items)) totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.quantity)

    return [id, [...totals].map(([itemId, quantity]) => ({ itemId, quantity }))]
  }))
  // Room container IDs include their room placement. Keep the moved safe's stock and deposits.
  const oldSafe = 'living-district:apartments:apartment-51:developer-container'
  const newSafe = 'living-district:apartments:apartment-21:developer-container'
  const containers = Object.fromEntries(Object.entries(saved.containers).map(([id, container]) => [id, { ...container, items: migrateStacks(container.items) }]))
  if (containers[oldSafe] && !containers[newSafe]) {
    containers[newSafe] = containers[oldSafe]
    delete containers[oldSafe]
    if (deposits[oldSafe]) {
      deposits[newSafe] = deposits[oldSafe]
      delete deposits[oldSafe]
    }
  }

  return {
    ...saved,
    items: migrateStacks(saved.items),
    containers,
    deposits,
    equipment: Object.fromEntries(Object.entries(saved.equipment ?? {}).map(([slot, id]) => [slot, readingItemId(id)])),
    readBooks: [...saved.readBooks ?? []],
    lootedCaches: saved.lootedCaches?.map(id => id === oldSafe ? newSafe : id),
    ...(saved.legendaryBarterStock ? {
      legendaryBarterStock: {
        ...saved.legendaryBarterStock,
        items: uniqueSources(saved.legendaryBarterStock.items)
          ? [
            ...new Map(migrateStacks(saved.legendaryBarterStock.items).map(item => [item.itemId, item])).values()
          ]
          : migrateStacks(saved.legendaryBarterStock.items)
      }
    } : {}),
  }
}

/**
 * Perform migrate reading.
 * @param {SaveGame} save - The save supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function migrateReading(save: SaveGame): void {
  save.inventory = migrateReadingInventory(save.inventory)
  if (save.notes) {
    const ids = save.notes.items.map(readingItemId)
    save.notes = {
      ...save.notes,
      items: new Set(save.notes.items).size === save.notes.items.length ? [...new Set(ids)] : ids
    }
  }

  const parameters = [
    ...save.quests.map(quest => quest.parameters),
    ...Object.values(save.courierBoard?.parameters ?? {}),
    ...Object.values(save.npcJobs?.parameters ?? {}),
  ]

  for (const parameter of parameters) if (parameter?.itemId) parameter.itemId = readingItemId(parameter.itemId)
}
