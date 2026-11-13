import { ObservableStore } from './ObservableStore.ts'
import { DayTime } from './DayTime.ts'
import { DAYTIME_CONFIG } from '../../content/daytime.ts'
import type { DayTimeController } from '../contracts/daytime'
import type { TravelController, TravelLocation, TravelSnapshot, TravelMode } from '../contracts/travel'

export class TravelService extends ObservableStore<TravelSnapshot> implements TravelController {
  private readonly daytime: Pick<DayTimeController, 'advance'> & Partial<Pick<DayTimeController, 'getSnapshot' | 'subscribe'>>
  private readonly travelsPerPhase: number
  private readonly nightDurationMultiplier: number
  private phaseTravels = 0
  private readonly payFare: (amount: number) => boolean
  private readonly getFare: () => number

  constructor(locations: readonly TravelLocation[], daytime: Pick<DayTimeController, 'advance'> & Partial<Pick<DayTimeController, 'getSnapshot' | 'subscribe'>> = new DayTime(), travelsPerPhase = 2,
    fare: { amount: number; pay: (amount: number) => boolean; free?: () => boolean } = { amount: 0, pay: () => true },
    nightDurationMultiplier = DAYTIME_CONFIG.nightDurationMultiplier) {
    if (!locations.length) throw new Error('At least one travel location is required')
    if (!Number.isInteger(travelsPerPhase) || travelsPerPhase < 1) throw new Error('travelsPerPhase must be a positive integer')
    if (!Number.isInteger(nightDurationMultiplier) || nightDurationMultiplier < 1) throw new Error('nightDurationMultiplier must be a positive integer')
    if (!Number.isSafeInteger(fare.amount) || fare.amount < 0) throw new Error('Bus fare must be a nonnegative integer')
    super({ locations, currentLocationId: locations[0].id, menuOpen: false, journey: 0, mode: 'bus', busFare: fare.amount, paymentFailed: false, destinationId: null, arrivalEdge: null })
    this.payFare = fare.pay
    this.getFare = () => fare.free?.() ? 0 : fare.amount
    this.daytime = daytime
    this.travelsPerPhase = travelsPerPhase
    this.nightDurationMultiplier = nightDurationMultiplier
    // Rest/sleep can skip the remaining night; retain only partial bus progress.
    daytime.subscribe?.(() => { this.phaseTravels %= this.travelsPerPhase })
  }

  openTravel = (mode: TravelMode = 'bus', direction: 'left' | 'right' = 'left'): boolean => {
    if (mode === 'bus' && this.daytime.getSnapshot?.().phase === 'night') return false
    const destinationId = mode === 'walk' ? this.snapshot.locations.find(location => location.id === this.snapshot.currentLocationId)?.connections?.[direction] ?? null : null
    if (mode === 'walk' && (!destinationId || destinationId === this.snapshot.currentLocationId || !this.snapshot.locations.some(location => location.id === destinationId))) return false
    if (!this.snapshot.menuOpen) this.publish({ ...this.snapshot, menuOpen: true, mode, busFare: this.getFare(), paymentFailed: false, destinationId })
    return true
  }

  closeTravel = (): void => {
    if (this.snapshot.menuOpen) this.publish({ ...this.snapshot, menuOpen: false, destinationId: null })
  }

  saveState = (): { locationId: string; phaseTravels: number } => ({ locationId: this.snapshot.currentLocationId, phaseTravels: this.phaseTravels })
  restoreState = (saved: { locationId: string; phaseTravels: number }): void => {
    this.phaseTravels = saved.phaseTravels
    this.publish({ ...this.snapshot, currentLocationId: saved.locationId, menuOpen: false, destinationId: null,
      paymentFailed: false, mode: 'bus', journey: 1, arrivalEdge: null })
  }

  travelTo = (locationId: string): void => {
    if (!this.snapshot.menuOpen || !this.snapshot.locations.some(location => location.id === locationId)) return
    if (this.snapshot.mode === 'walk') {
      const connections = this.snapshot.locations.find(location => location.id === this.snapshot.currentLocationId)?.connections
      if (locationId !== this.snapshot.destinationId || ![connections?.left, connections?.right].includes(locationId)) return
    }
    if (this.snapshot.mode === 'bus' && this.daytime.getSnapshot?.().phase === 'night') {
      this.closeTravel()
      return
    }
    const destination = this.snapshot.locations.find(location => location.id === locationId)!
    const arrivalEdge = this.snapshot.mode === 'walk'
      ? destination.connections?.left === this.snapshot.currentLocationId ? 'left' : 'right'
      : null
    // Publish time before arrival so the new world uses the destination's lighting.
    if (locationId !== this.snapshot.currentLocationId) {
      if (this.snapshot.mode === 'bus') {
        const busFare = this.getFare()
        if (busFare > 0 && !this.payFare(busFare)) {
          this.publish({ ...this.snapshot, busFare, paymentFailed: true })
          return
        }
      }
      // Walking spends one ordinary phase of time; night lasts multiple such trips.
      this.phaseTravels += this.snapshot.mode === 'walk' ? this.travelsPerPhase : 1
      const duration = this.travelsPerPhase * (this.daytime.getSnapshot?.().phase === 'night' ? this.nightDurationMultiplier : 1)
      if (this.phaseTravels >= duration) {
        this.phaseTravels -= duration
        this.daytime.advance()
      }
    }
    this.publish({ ...this.snapshot, currentLocationId: locationId, menuOpen: false, journey: this.snapshot.journey + 1, paymentFailed: false, destinationId: null, arrivalEdge })
  }

}

