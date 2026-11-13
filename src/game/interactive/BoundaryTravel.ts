import type { TravelController } from '../../app/contracts/travel'

/** Rearm only after leaving the edge so canceling the menu never traps the player. */
export class BoundaryTravel {
  private readonly travel: Pick<TravelController, 'openTravel'>
  private atBoundary = false

  constructor(travel: Pick<TravelController, 'openTravel'>) { this.travel = travel }

  update(x: number, bounds: { left: number; right: number }, enabled = true): boolean {
    if (!enabled || (x > bounds.left && x < bounds.right)) {
      this.atBoundary = false
      return false
    }
    if (this.atBoundary) return false
    this.atBoundary = true
    return this.travel.openTravel('walk', x <= bounds.left ? 'left' : 'right')
  }
}
