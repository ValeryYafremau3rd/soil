import type { PerksController } from '../../contracts/perks'
import type { InventoryService } from '../../services/inventory/InventoryService'
import { StatisticsService } from '../../services/progression/StatisticsService'

/**
 * Record committed loot and gate ordinary statistics during startup grants and restoration.
 * @param {InventoryService} inventory - Inventory action and loot event source.
 * @param {PerksController} perks - Perk progression recorder.
 * @param {StatisticsService} statistics - Committed gameplay statistics recorder.
 * @returns {{ enabled: boolean }} Startup statistics gate owned by the session bootstrap.
 */
export function wireInventoryEvents(
  inventory: InventoryService,
  perks: PerksController,
  statistics: StatisticsService,
): { enabled: boolean } {
  inventory.subscribeLoot(pickup => {
    for (const stack of pickup.items) for (let unit = 0;unit < stack.quantity;unit++) perks.recordAction('itemLooted')
  })
  const tracking = { enabled: false }
  inventory.onStatistic = (id, amount) => {
    if (tracking.enabled) statistics.record(id, amount)
  }
  inventory.subscribeLoot(pickup => {
    for (const stack of pickup.items) {
      statistics.record('itemsLooted', stack.quantity)
      if (stack.itemId === 'money') statistics.record('moneyEarned', stack.quantity)
    }
  })
  return tracking
}
