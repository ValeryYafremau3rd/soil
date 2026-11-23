/**
 * Human sprites follow the hero's indoor reduction in corridors as well as rooms.
 * @param {{ displayHeight: number; scale?: number | undefined; }} definition - The definition supplied to this operation.
 * @param {{ scale: number; roomScale: number; }} heroScale - The hero scale supplied to this operation.
 * @param {number} clearance - The clearance supplied to this operation.
 * @param {number} headroom - The headroom supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function interiorNpcScale(
  definition: {
    displayHeight: number
    scale?: number
  },
  heroScale: {
    scale: number
    roomScale: number
  },
  clearance: number,
  headroom: number,
): number {
  return Math.min((definition.scale ?? 1) * heroScale.roomScale / heroScale.scale,
    (clearance - headroom) / definition.displayHeight)
}
