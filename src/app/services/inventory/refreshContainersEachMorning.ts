import type { DayTimeController } from '../../contracts/daytime'
import type { InventoryController } from '../../contracts/inventory'

/**
 * Outdoor loot refills at night and clears at morning; other stock refreshes each morning.
 * @param {Pick<DayTimeController, "getSnapshot" | "subscribe">} daytime - The daytime supplied to this operation.
 * @param {Pick<InventoryController, "refreshContainers">} inventory - Inventory capability used to read or transact items.
 * @returns {() => void} Callback that releases or performs the registered operation.
 */
export function refreshContainersEachMorning(
  daytime: Pick<DayTimeController, 'getSnapshot' | 'subscribe'>,
  inventory: Pick<InventoryController, 'refreshContainers'>
): () => void {
  let lastMorning = daytime.getSnapshot().day
  let previous = daytime.getSnapshot()

  return daytime.subscribe(() => {
    const time = daytime.getSnapshot()
    const enteredNight = time.phase === 'night' && (previous.phase !== 'night' || previous.day !== time.day)
    previous = time
    if (enteredNight) {
      inventory.refreshContainers('night')

      return
    }

    if (time.phase !== 'morning' || time.day <= lastMorning) return

    lastMorning = time.day
    inventory.refreshContainers()
  })
}
