import { legendarySkill } from '../skills/effects.ts'
/**
 * Configured energy costs for movement distance and jumps.
 */
export interface MovementEnergyCosts {
  jump: number
  perPixel: number
}

/**
 * Charge actual walking/climbing distance and successful jumps, without rounding frame costs.
 * @param {number} distance - The distance supplied to this operation.
 * @param {boolean} jumped - The jumped supplied to this operation.
 * @param {MovementEnergyCosts} costs - The costs supplied to this operation.
 * @param {number} multiplier - Scaling factor applied to the base value.
 * @param {number} athletics - The athletics supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function movementEnergyCost(
  distance: number,
  jumped: boolean,
  costs: MovementEnergyCosts,
  multiplier = 1,
  athletics = 0
): number {
  if (legendarySkill({ athletics }, 'athletics')) return 0

  const traveled = Number.isFinite(distance) ? Math.max(0, distance) : 0

  return (traveled * costs.perPixel + (jumped ? costs.jump : 0)) * multiplier
}
