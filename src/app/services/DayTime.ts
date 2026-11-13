import { DAY_PHASES } from '../contracts/daytime.ts'
import type { DayPhase, DayTimeController, DayTimeSnapshot } from '../contracts/daytime'
import { ObservableStore } from './ObservableStore.ts'
import { rollWeather } from '../../domain/character/weather.ts'
import type { Weather } from '../../domain/character/weather.ts'

/** Owns the phase cycle; the travel service decides when enough journeys have elapsed. */
export class DayTime extends ObservableStore<DayTimeSnapshot> implements DayTimeController {
  private readonly random: () => number
  constructor(day = 1, phase: DayPhase = DAY_PHASES[0], weather?: Weather, random: () => number = Math.random) {
    super({ day, phase, weather: weather ?? rollWeather(random) })
    this.random = random
  }

  advance = (): void => {
    const index = (DAY_PHASES.indexOf(this.snapshot.phase) + 1) % DAY_PHASES.length
    const phase = DAY_PHASES[index]
    this.publish({ day: this.snapshot.day + (index === 0 ? 1 : 0), phase,
      weather: phase === 'night' ? rollWeather(this.random) : this.snapshot.weather })
  }

  nextMorning = (): void => { this.publish({ day: this.snapshot.day + 1, phase: DAY_PHASES[0],
    weather: this.snapshot.phase === 'night' ? this.snapshot.weather : rollWeather(this.random) }) }
}
