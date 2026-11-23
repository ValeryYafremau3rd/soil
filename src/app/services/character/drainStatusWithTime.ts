import { DAY_PHASES } from '../../contracts/daytime.ts'
import type { DayTimeController, DayTimeSnapshot } from '../../contracts/daytime'
import type { StatusController } from '../../contracts/status'
import { advanceSleepDebt } from '../../../domain/character/sleep.ts'
import type { SleepSettings } from '../../../domain/character/sleep'

/**
 * Perform phase index.
 * @param {DayTimeSnapshot} time - The time supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
const phaseIndex = (time: DayTimeSnapshot): number => (time.day - 1) * DAY_PHASES.length + DAY_PHASES.indexOf(time.phase)

/**
 * Costs are percentages of current limits per phase; rest/sleep exempt Energy only.
 * @param {Pick<DayTimeController, "getSnapshot" | "subscribe">} daytime - The daytime supplied to this operation.
 * @param {Pick<StatusController, "getLimits" | "drain">} status - The status supplied to this operation.
 * @param {{ energy: number; sanity: number; }} costs - The costs supplied to this operation.
 * @param {() => boolean} skipEnergyCost - The skip energy cost supplied to this operation.
 * @param {(SleepSettings & { awakePhases: number; isSleeping(): boolean; }) | undefined} sleep - The sleep supplied to this operation.
 * @returns {() => void} Callback that releases or performs the registered operation.
 */
export function drainStatusWithTime(
  daytime: Pick<DayTimeController, 'getSnapshot' | 'subscribe'>,
  status: Pick<StatusController, 'drain' | 'getLimits'>,
  costs: {
    energy: number
    sanity: number
  },
  skipEnergyCost: () => boolean = () => false,
  sleep?: SleepSettings & {
    awakePhases: number
    isSleeping(): boolean
  }
): () => void {
  let previous = phaseIndex(daytime.getSnapshot())

  return daytime.subscribe(() => {
    const current = phaseIndex(daytime.getSnapshot())
    const elapsed = Math.max(0, current - previous)
    previous = current
    if (elapsed) {
      const debt = sleep ? advanceSleepDebt(sleep.awakePhases, elapsed, sleep.isSleeping(), sleep) : { awakePhases: 0, damage: 0 }
      if (sleep) sleep.awakePhases = debt.awakePhases

      const limits = status.getLimits()
      status.drain({
        energy: skipEnergyCost() ? 0 : limits.energy * costs.energy / 100 * elapsed,
        sanity: limits.sanity * costs.sanity / 100 * elapsed + debt.damage
      })
    }
  })
}
