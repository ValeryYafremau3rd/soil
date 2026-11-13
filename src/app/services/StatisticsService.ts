import type { Statistic, StatisticsController, StatisticsSnapshot } from '../contracts/statistics'
import { FRACTIONAL_STATISTICS, STATISTICS } from '../contracts/statistics.ts'
import { ObservableStore } from './ObservableStore.ts'

/** Totals for committed gameplay actions. */
export class StatisticsService extends ObservableStore<StatisticsSnapshot> implements StatisticsController {
  constructor(saved: StatisticsSnapshot = {}) { super({ ...saved }) }
  record = (statistic: Statistic, amount = 1): void => {
    if (!Object.hasOwn(STATISTICS, statistic) || (!FRACTIONAL_STATISTICS.includes(statistic) && !Number.isSafeInteger(amount))) return
    const next = (this.snapshot[statistic] ?? 0) + amount
    if (!Number.isFinite(amount) || amount <= 0 || next > Number.MAX_SAFE_INTEGER) return
    this.publish({ ...this.snapshot, [statistic]: next })
  }
}
