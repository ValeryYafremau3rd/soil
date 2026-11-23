import type { Statistic, StatisticsController, StatisticsSnapshot } from '../../contracts/statistics'
import { FRACTIONAL_STATISTICS, STATISTICS } from '../../contracts/statistics.ts'
import { ObservableStore } from '../core/ObservableStore.ts'

/** Totals for committed gameplay actions. */
export class StatisticsService extends ObservableStore<StatisticsSnapshot> implements StatisticsController {
  /**
   * Initialize the StatisticsService instance and its collaborators.
   * @param {object} saved - The saved supplied to this operation.
   * @returns {StatisticsService} The initialized instance.
   */
  constructor(saved: StatisticsSnapshot = {}) {
    super({ ...saved })
  }

  /**
   * Perform record for StatisticsService.
   * @param {object} statistic - The statistic supplied to this operation.
   * @param {number} amount - Amount to apply to the operation.
   * @returns {void} Completes the operation without returning a value.
   */
  record = (
    statistic: Statistic,
    amount = 1
  ): void => {
    if (!Object.hasOwn(STATISTICS, statistic) || (!FRACTIONAL_STATISTICS.includes(statistic) && !Number.isSafeInteger(amount))) return

    const next = (this.snapshot[statistic] ?? 0) + amount
    if (!Number.isFinite(amount) || amount <= 0 || next > Number.MAX_SAFE_INTEGER) return

    this.publish({ ...this.snapshot, [statistic]: next })
  }
}
