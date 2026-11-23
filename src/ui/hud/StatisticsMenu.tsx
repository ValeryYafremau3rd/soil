import { useSyncExternalStore } from 'react'
import { STATISTICS } from '../../app/contracts/statistics'
import type { Statistic, StatisticsController } from '../../app/contracts/statistics'

/**
 * Perform statistics menu.
 * @param {{ statistics: Pick<StatisticsController, 'subscribe' | 'getSnapshot'> }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function StatisticsMenu({ statistics }: {
  statistics: Pick<StatisticsController, 'subscribe' | 'getSnapshot'>
}) {
  const totals = useSyncExternalStore(statistics.subscribe, statistics.getSnapshot)

  return <section className="character-details" aria-label="Gameplay statistics">
    <p>Totals for this character. Distance uses world pixels.</p>
    <dl>{(Object.keys(STATISTICS) as Statistic[]).map(id => <div key={id}>
      <dt>{STATISTICS[id]}</dt><dd>{Math.floor(totals[id] ?? 0).toLocaleString()}</dd>
    </div>)}</dl>
  </section>
}
