import { isNearEntrance } from './navigation.ts'
import type { Point } from './navigation'

/**
 * Door position and room identity used by interior navigation.
 */
export interface RoomDoor extends Point {
  id: string
  floor: number
}

/**
 * Doors on other floors cannot be reached through ceilings or staircases.
 * @param {readonly RoomDoor[]} doors - The doors supplied to this operation.
 * @param {number} floor - The floor supplied to this operation.
 * @param {Point} point - The point supplied to this operation.
 * @param {number} radius - The radius supplied to this operation.
 * @returns {RoomDoor | undefined} The result described by the TypeScript return signature.
 */
export function nearestRoomDoor(
  doors: readonly RoomDoor[],
  floor: number,
  point: Point,
  radius: number
): RoomDoor | undefined {
  return doors.filter(door => door.floor === floor && isNearEntrance(point, door, radius))
    .sort((a, b) => Math.abs(a.x - point.x) - Math.abs(b.x - point.x))[0]
}
