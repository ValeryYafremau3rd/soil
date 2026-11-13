import { legendarySkill } from '../skills/effects.ts'
export interface MovementEnergyCosts { jump: number; perPixel: number }

/** Charge actual walking/climbing distance and successful jumps, without rounding frame costs. */
export function movementEnergyCost(distance: number, jumped: boolean, costs: MovementEnergyCosts, multiplier = 1, athletics = 0): number {
  if (legendarySkill({ athletics }, 'athletics')) return 0
  const traveled = Number.isFinite(distance) ? Math.max(0, distance) : 0
  return (traveled * costs.perPixel + (jumped ? costs.jump : 0)) * multiplier
}
