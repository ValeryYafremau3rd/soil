export interface Point { x: number; y: number }

/** Clearance is measured in world pixels, after applying the building's scale. */
export function interiorClearance(authoredHeight: number, minimumHeight: number, heroHeight: number, headroom: number): number {
  return Math.max(authoredHeight, minimumHeight, heroHeight + headroom)
}

export interface StairConnection {
  fromFloor: number
  toFloor: number
  fromX: number
  toX: number
  landingX: number
}

export function stairRoute(connections: readonly StairConnection[], floor: number, direction: number, x: number, radius: number) {
  if (!direction) return undefined
  const ascending = direction > 0
  const connection = connections.filter(stair => (ascending ? stair.fromFloor : stair.toFloor) === floor)
    .map(stair => ({ targetFloor: ascending ? stair.toFloor : stair.fromFloor,
      fromX: ascending ? stair.fromX : stair.toX, toX: ascending ? stair.toX : stair.fromX, landingX: stair.landingX }))
    .sort((a, b) => Math.abs(a.fromX - x) - Math.abs(b.fromX - x))[0]
  return connection && Math.abs(connection.fromX - x) <= radius ? connection : undefined
}

export function isNearEntrance(position: Point, entrance: Point, radius: number): boolean {
  return Math.abs(position.x - entrance.x) <= radius && Math.abs(position.y - entrance.y) <= radius
}

export function adjacentFloor(current: number, direction: number, count: number): number | undefined {
  const target = current + Math.sign(direction)
  return direction !== 0 && target >= 0 && target < count ? target : undefined
}

export function stairPosition(start: Point, landing: Point, end: Point, progress: number): Point {
  const t = Math.max(0, Math.min(1, progress))
  const from = t < 0.5 ? start : landing
  const to = t < 0.5 ? landing : end
  const local = t < 0.5 ? t * 2 : (t - 0.5) * 2
  return { x: from.x + (to.x - from.x) * local, y: from.y + (to.y - from.y) * local }
}
