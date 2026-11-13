import { DAY_PHASES } from '../contracts/daytime.ts'
import type { DayTimeController, DayTimeSnapshot } from '../contracts/daytime'
import type { StatusController } from '../contracts/status'
import { advanceSleepDebt } from '../../domain/character/sleep.ts'
import type { SleepSettings } from '../../domain/character/sleep'

const phaseIndex = (time: DayTimeSnapshot): number => (time.day - 1) * DAY_PHASES.length + DAY_PHASES.indexOf(time.phase)

/** Charge elapsed game time; rest/sleep may exempt Energy while retaining Sanity costs. */
export function drainStatusWithTime(daytime: Pick<DayTimeController, 'getSnapshot' | 'subscribe'>,
  status: Pick<StatusController, 'drain'>, costs: { energy: number; sanity: number },
  skipEnergyCost: () => boolean = () => false, sleep?: SleepSettings & { awakePhases: number; isSleeping(): boolean }): () => void {
  let previous = phaseIndex(daytime.getSnapshot())
  return daytime.subscribe(() => {
    const current = phaseIndex(daytime.getSnapshot())
    const elapsed = Math.max(0, current - previous)
    previous = current
    if (elapsed) {
      const debt = sleep ? advanceSleepDebt(sleep.awakePhases, elapsed, sleep.isSleeping(), sleep) : { awakePhases: 0, damage: 0 }
      if (sleep) sleep.awakePhases = debt.awakePhases
      status.drain({ energy: skipEnergyCost() ? 0 : costs.energy * elapsed, sanity: costs.sanity * elapsed + debt.damage })
    }
  })
}
