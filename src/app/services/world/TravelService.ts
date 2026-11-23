import { UI_CONFIG } from '../../../content/ui.ts'
import type { SaveGame } from '../../contracts/save'
import { ObservableStore } from '../core/ObservableStore.ts'
import { DayTimeService } from './DayTimeService.ts'
import { DAYTIME_CONFIG } from '../../../content/daytime.ts'
import type { DayTimeController } from '../../contracts/daytime'
import type { TravelController, TravelLocation, TravelSnapshot, TravelMode } from '../../contracts/travel'

/**
 * Owns travel service state and behavior.
 */
export class TravelService extends ObservableStore<TravelSnapshot> implements TravelController {
  /**
   * Perform on completed for TravelService.
   * @returns {void} Completes the operation without returning a value.
   */
  onCompleted: (mode: TravelMode) => void = () => { }
  private readonly daytime: Pick<DayTimeController, 'advance'> & Partial<Pick<DayTimeController, 'getSnapshot' | 'subscribe'>>
  private readonly travelsPerPhase: number
  private readonly nightDurationMultiplier: number
  private phaseTravels = 0
  private storySeen = false
  private storyPending = false
  private readonly openingStory: boolean
  private readonly payFare: (amount: number) => boolean
  private readonly getFare: () => number

  /**
   * Initialize the TravelService instance and its collaborators.
   * @param {readonly TravelLocation[]} locations - The locations supplied to this operation.
   * @param {Pick<DayTimeController, "advance"> & Partial<Pick<DayTimeController, "getSnapshot" | "subscribe">>} daytime - The daytime supplied to this operation.
   * @param {number} travelsPerPhase - The travels per phase supplied to this operation.
   * @param {{ amount: number; pay: (amount: number) => boolean; free?: (() => boolean) | undefined; }} fare - The fare supplied to this operation.
   * @param {number} nightDurationMultiplier - The night duration multiplier supplied to this operation.
   * @param {boolean} openingStory - Enable the opening slides for playable sessions; defaults to false.
   * @returns {TravelService} The initialized instance.
   */
  constructor(
    locations: readonly TravelLocation[],
    daytime: Pick<DayTimeController, 'advance'> & Partial<Pick<DayTimeController, 'getSnapshot' | 'subscribe'>> = new DayTimeService(),
    travelsPerPhase = 2,
    fare: {
      amount: number
      pay: (amount: number) => boolean
      free?: () => boolean
    } = { amount: 0, pay: () => true },
    nightDurationMultiplier = DAYTIME_CONFIG.nightDurationMultiplier,
    openingStory = false
  ) {
    if (!locations.length) throw new Error('At least one travel location is required')

    if (!Number.isInteger(travelsPerPhase) || travelsPerPhase < 1) throw new Error('travelsPerPhase must be a positive integer')

    if (!Number.isInteger(nightDurationMultiplier) || nightDurationMultiplier < 1) throw new Error('nightDurationMultiplier must be a positive integer')

    if (!Number.isSafeInteger(fare.amount) || fare.amount < 0) throw new Error('Bus fare must be a nonnegative integer')

    super({
      locations,
      storySlide: null,
      currentLocationId: locations[0].id,
      menuOpen: false,
      journey: 0,
      mode: 'bus',
      busFare: fare.amount,
      paymentFailed: false,
      destinationId: null,
      arrivalEdge: null
    })
    this.openingStory = openingStory
    this.payFare = fare.pay
    this.getFare = () => fare.free?.() ? 0 : fare.amount
    this.daytime = daytime
    this.travelsPerPhase = travelsPerPhase
    this.nightDurationMultiplier = nightDurationMultiplier
    // Rest/sleep can skip the remaining night; discard completed phase progress.
    daytime.subscribe?.(() => {
      this.phaseTravels %= this.travelsPerPhase
    })
  }

  /**
   * Open travel.
   * @param {TravelMode} mode - The mode supplied to this operation.
   * @param {"left" | "right"} direction - The direction supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  openTravel = (
    mode: TravelMode = 'bus',
    direction: 'left' | 'right' = 'left'
  ): boolean => {
    if (this.storyPending || this.snapshot.storySlide !== null) return false

    if (mode === 'bus' && this.daytime.getSnapshot?.().phase === 'night') return false

    const destinationId = mode === 'walk' ? this.snapshot.locations.find(location => location.id === this.snapshot.currentLocationId)?.connections?.[direction] ?? null : null
    if (mode === 'walk' && (!destinationId || destinationId === this.snapshot.currentLocationId || !this.snapshot.locations.some(location => location.id === destinationId))) return false

    if (!this.snapshot.menuOpen) this.publish({
      ...this.snapshot,
      menuOpen: true,
      mode,
      busFare: this.getFare(),
      paymentFailed: false,
      destinationId
    })

    return true
  }

  /**
   * Close travel.
   * @returns {void} Completes the operation without returning a value.
   */
  closeTravel = (): void => {
    if (this.snapshot.menuOpen) this.publish({ ...this.snapshot, menuOpen: false, destinationId: null })
  }

  /**
   * Save state.
   * @returns {{ locationId: string; phaseTravels: number; }} The result described by the TypeScript return signature.
   */
  saveState = (): SaveGame['travel'] => ({
    locationId: this.snapshot.currentLocationId,
    phaseTravels: this.phaseTravels,
    storySeen: this.storySeen && this.snapshot.storySlide === null,
  })

  /**
   * Restore state.
   * @param {{ locationId: string; phaseTravels: number; }} saved - The saved supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  restoreState = (saved: SaveGame['travel']): void => {
    this.storySeen = saved.storySeen ?? false
    // Only explicit unfinished saves resume slides; legacy saves did not track arrival stories.
    this.storyPending = this.openingStory && saved.storySeen === false
      && saved.locationId === UI_CONFIG.story.destinationLocationId
    this.phaseTravels = saved.phaseTravels
    this.publish({
      ...this.snapshot,
      currentLocationId: saved.locationId,
      storySlide: null,
      menuOpen: false,
      destinationId: null,
      paymentFailed: false,
      mode: 'bus',
      journey: 1,
      arrivalEdge: null
    })
  }

  /**
   * Perform travel to for TravelService.
   * @param {string} locationId - The location id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  travelTo = (locationId: string): void => {
    if (!this.snapshot.menuOpen || !this.snapshot.locations.some(location => location.id === locationId)) return

    if (this.snapshot.mode === 'walk') {
      const connections = this.snapshot.locations.find(location => location.id === this.snapshot.currentLocationId)?.connections
      if (locationId !== this.snapshot.destinationId || ![connections?.left, connections?.right].includes(locationId)) return
    }

    this.completeTravel(locationId, this.snapshot.mode)
  }

  /**
   * Perform walk to boundary for TravelService.
   * @param {"left" | "right"} direction - The direction supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  walkToBoundary = (direction: 'left' | 'right'): boolean => {
    if (this.storyPending || this.snapshot.menuOpen || this.snapshot.storySlide !== null) return false

    const destination = this.snapshot.locations.find(location => location.id === this.snapshot.currentLocationId)?.connections?.[direction]
    if (!destination || destination === this.snapshot.currentLocationId || !this.snapshot.locations.some(location => location.id === destination)) return false

    this.completeTravel(destination, 'walk')

    return true
  }

  /**
   * Present a queued arrival story only after the destination's loading overlay finishes.
   * @returns {void} Starts once, leaving scene restart and texture preparation unpaused.
   */
  finishLocationLoad = (): void => {
    if (!this.storyPending || this.storySeen
      || this.snapshot.currentLocationId !== UI_CONFIG.story.destinationLocationId) return

    this.storyPending = false
    this.storySeen = true
    this.publish({ ...this.snapshot, storySlide: 0 })
  }

  /**
   * Advance the opening story and release gameplay after the final slide.
   * @returns {void} Publishes the next slide or closes the story.
   */
  nextStorySlide = (): void => {
    const current = this.snapshot.storySlide
    if (current === null) return

    const next = current + 1
    this.publish({
      ...this.snapshot,
      storySlide: next < UI_CONFIG.story.slides.length ? next : null,
    })
  }

  /**
   * Revisit the preceding opening slide without leaving the story or unpausing play.
   * @returns {void} Leaves the first slide and closed story unchanged.
   */
  previousStorySlide = (): void => {
    const current = this.snapshot.storySlide
    if (current === null || current === 0) return

    this.publish({ ...this.snapshot, storySlide: current - 1 })
  }

  /**
   * Perform complete travel for TravelService.
   * @param {string} locationId - The location id supplied to this operation.
   * @param {TravelMode} mode - The mode supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private completeTravel(
    locationId: string,
    mode: TravelMode
  ): void {
    if (mode === 'bus' && this.daytime.getSnapshot?.().phase === 'night') {
      this.closeTravel()

      return
    }

    const destination = this.snapshot.locations.find(location => location.id === locationId)!
    const arrivalEdge = mode === 'walk'
      ? destination.connections?.left === this.snapshot.currentLocationId ? 'left' : 'right'
      : null
    // Publish time before arrival so the new world uses the destination's lighting.
    if (locationId !== this.snapshot.currentLocationId) {
      if (mode === 'bus') {
        const busFare = this.getFare()
        if (busFare > 0 && !this.payFare(busFare)) {
          this.publish({ ...this.snapshot, busFare, paymentFailed: true })

          return
        }
      }
      // Walking spends one ordinary phase of time; night lasts multiple such trips.
      this.phaseTravels += mode === 'walk' ? this.travelsPerPhase : 0
      const duration = this.travelsPerPhase * (this.daytime.getSnapshot?.().phase === 'night' ? this.nightDurationMultiplier : 1)
      if (mode === 'walk' && this.phaseTravels >= duration) {
        this.phaseTravels -= duration
        this.daytime.advance()
      }
    }

    if (locationId !== this.snapshot.currentLocationId) this.onCompleted(mode)

    this.storyPending = this.openingStory && !this.storySeen
      && this.snapshot.currentLocationId === UI_CONFIG.story.sourceLocationId
      && locationId === UI_CONFIG.story.destinationLocationId

    this.publish({
      ...this.snapshot,
      storySlide: null,
      mode,
      currentLocationId: locationId,
      menuOpen: false,
      journey: this.snapshot.journey + 1,
      paymentFailed: false,
      destinationId: null,
      arrivalEdge
    })
  }
}

