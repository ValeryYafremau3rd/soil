import type { TravelController } from '../../app/contracts/travel'

/** Trigger once per edge contact; arrivals spawn inside the destination boundary. */
export class BoundaryTravel {
  private readonly travel: Pick<TravelController, 'walkToBoundary'>
  private atBoundary = false

  /**
   * Initialize the BoundaryTravel instance and its collaborators.
   * @param {Pick<TravelController, "walkToBoundary">} travel - The travel supplied to this operation.
   * @returns {BoundaryTravel} The initialized instance.
   */
  constructor(travel: Pick<TravelController, 'walkToBoundary'>) {
    this.travel = travel
  }

  /**
   * Perform update for BoundaryTravel.
   * @param {number} x - Horizontal coordinate.
   * @param {{ left: number; right: number; }} bounds - The bounds supplied to this operation.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  update(x: number, bounds: {
    left: number
    right: number
  }, enabled = true): boolean {
    if (!enabled || (x > bounds.left && x < bounds.right)) {
      this.atBoundary = false

      return false
    }

    if (this.atBoundary) return false

    this.atBoundary = true

    return this.travel.walkToBoundary(x <= bounds.left ? 'left' : 'right')
  }
}
