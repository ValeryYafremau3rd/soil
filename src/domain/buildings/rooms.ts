import { isNearEntrance } from './navigation.ts'
import type { Point } from './navigation'

export interface RoomDoor extends Point { id: string; floor: number }

/** Doors on other floors cannot be reached through ceilings or staircases. */
export function nearestRoomDoor(doors: readonly RoomDoor[], floor: number, point: Point, radius: number): RoomDoor | undefined {
  return doors.filter(door => door.floor === floor && isNearEntrance(point, door, radius))
    .sort((a, b) => Math.abs(a.x - point.x) - Math.abs(b.x - point.x))[0]
}
