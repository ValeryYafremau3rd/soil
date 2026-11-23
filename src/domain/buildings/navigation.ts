/**
 * Two-dimensional coordinate used by geometry rules.
 */
export interface Point {
  x: number
  y: number
}

/**
 * Clearance is measured in world pixels, after applying the building's scale.
 * @param {number} authoredHeight - The authored height supplied to this operation.
 * @param {number} minimumHeight - The minimum height supplied to this operation.
 * @param {number} heroHeight - The hero height supplied to this operation.
 * @param {number} headroom - The headroom supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function interiorClearance(
  authoredHeight: number,
  minimumHeight: number,
  heroHeight: number,
  headroom: number
): number {
  return Math.max(authoredHeight, minimumHeight, heroHeight + headroom)
}

/**
 * Connection between floors used to resolve stair travel.
 */
export interface StairConnection {
  fromFloor: number
  toFloor: number
  fromX: number
  toX: number
  landingX: number
}

/**
 * Perform stair route.
 * @param {readonly StairConnection[]} connections - The connections supplied to this operation.
 * @param {number} floor - The floor supplied to this operation.
 * @param {number} direction - The direction supplied to this operation.
 * @param {number} x - Horizontal coordinate.
 * @param {number} radius - The radius supplied to this operation.
 * @returns {{ targetFloor: number; fromX: number; toX: number; landingX: number; } | undefined} The result described by the TypeScript return signature.
 */
export function stairRoute(
  connections: readonly StairConnection[],
  floor: number,
  direction: number,
  x: number,
  radius: number
) {
  if (!direction) return undefined

  const ascending = direction > 0
  const connection = connections.filter(stair => (ascending ? stair.fromFloor : stair.toFloor) === floor)
    .map(stair => ({
      targetFloor: ascending ? stair.toFloor : stair.fromFloor,
      fromX: ascending ? stair.fromX : stair.toX,
      toX: ascending ? stair.toX : stair.fromX,
      landingX: stair.landingX
    }))
    .sort((a, b) => Math.abs(a.fromX - x) - Math.abs(b.fromX - x))[0]

  return connection && Math.abs(connection.fromX - x) <= radius ? connection : undefined
}

/**
 * Check whether near entrance is true.
 * @param {Point} position - The position supplied to this operation.
 * @param {Point} entrance - The entrance supplied to this operation.
 * @param {number} radius - The radius supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function isNearEntrance(
  position: Point,
  entrance: Point,
  radius: number
): boolean {
  return Math.abs(position.x - entrance.x) <= radius && Math.abs(position.y - entrance.y) <= radius
}

/**
 * Perform adjacent floor.
 * @param {number} current - The current supplied to this operation.
 * @param {number} direction - The direction supplied to this operation.
 * @param {number} count - The count supplied to this operation.
 * @returns {number | undefined} The result described by the TypeScript return signature.
 */
export function adjacentFloor(
  current: number,
  direction: number,
  count: number
): number | undefined {
  const target = current + Math.sign(direction)

  return direction !== 0 && target >= 0 && target < count ? target : undefined
}

/**
 * Perform stair position.
 * @param {Point} start - The start supplied to this operation.
 * @param {Point} landing - The landing supplied to this operation.
 * @param {Point} end - The end supplied to this operation.
 * @param {number} progress - The progress supplied to this operation.
 * @returns {Point} The result described by the TypeScript return signature.
 */
export function stairPosition(
  start: Point,
  landing: Point,
  end: Point,
  progress: number
): Point {
  const t = Math.max(0, Math.min(1, progress))
  const from = t < 0.5 ? start : landing
  const to = t < 0.5 ? landing : end
  const local = t < 0.5 ? t * 2 : (t - 0.5) * 2

  return { x: from.x + (to.x - from.x) * local, y: from.y + (to.y - from.y) * local }
}
