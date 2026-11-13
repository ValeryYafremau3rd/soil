import type { DayTimeController } from '../contracts/daytime'
import type { InventoryController } from '../contracts/inventory'

/** Outdoor loot refills at night and clears at morning; other stock refreshes each morning. */
export function refreshContainersEachMorning(daytime: Pick<DayTimeController, 'getSnapshot' | 'subscribe'>,
  inventory: Pick<InventoryController, 'refreshContainers'>): () => void {
  let lastMorning = daytime.getSnapshot().day
  let previous = daytime.getSnapshot()
  return daytime.subscribe(() => {
    const time = daytime.getSnapshot()
    const enteredNight = time.phase === 'night' && (previous.phase !== 'night' || previous.day !== time.day)
    previous = time
    if (enteredNight) { inventory.refreshContainers('night'); return }
    if (time.phase !== 'morning' || time.day <= lastMorning) return
    lastMorning = time.day
    inventory.refreshContainers()
  })
}
