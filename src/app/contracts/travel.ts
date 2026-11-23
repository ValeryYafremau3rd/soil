/**
 * District identity, connections and arrival information used by travel rules.
 */
export interface TravelLocation {
  connections?: {
    left?: string
    right?: string
  }
  id: string
  name: string
  description: string
  background: {
    key: string
    path: string
    height: number
    groundRatio: number
    scale?: number
    scrollFactor?: number
  }
  busStop: {
    x: number
    scale: number
    interactionRadius: number
    spawnOffset: number
  }
  buildings: readonly {
    id: string
    type: string
    entranceX: number
    enabled?: boolean
    scale?: number
  }[]
  initialSpawn?: {
    buildingId: string
    roomId: string
    x: number
  }
  npc?: {
    type: string
    x: number
    enabled?: boolean
    scale?: number
  }
}

export type TravelMode = 'bus' | 'walk'

/**
 * Observable travel state exposed to service subscribers.
 */
export interface TravelSnapshot {
  readonly storySlide: number | null
  readonly arrivalEdge: 'left' | 'right' | null
  readonly destinationId: string | null
  readonly busFare: number
  readonly paymentFailed: boolean
  readonly locations: readonly TravelLocation[]
  readonly currentLocationId: string
  readonly menuOpen: boolean
  readonly journey: number
  readonly mode: TravelMode
}

/**
 * Typed travel actions and queries exposed across application layers.
 */
export interface TravelController {
  getSnapshot(): TravelSnapshot
  subscribe(listener: () => void): () => void
  openTravel(mode?: TravelMode, direction?: 'left' | 'right'): boolean
  closeTravel(): void
  walkToBoundary(direction: 'left' | 'right'): boolean
  travelTo(locationId: string): void
  nextStorySlide(): void
  previousStorySlide(): void
}
