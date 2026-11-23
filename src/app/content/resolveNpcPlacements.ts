import type { DayPhase } from '../contracts/daytime'
import type { TravelLocation } from '../contracts/travel'
import type { NpcDefinition } from '../../content/types'

/**
 * NPC placement after schedule and location defaults have been applied.
 */
export interface ResolvedNpcPlacement {
  type: string
  x: number
  scale: number
  buildingId?: string
  roomId?: string
  floor?: number
}

/**
 * Resolve the whole roster so scheduled NPCs can appear outside their home district.
 * @param {Readonly<Record<string, NpcDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {readonly TravelLocation[]} locations - The locations supplied to this operation.
 * @param {string} locationId - The location id supplied to this operation.
 * @param {"morning" | "afternoon" | "evening" | "night"} phase - The phase supplied to this operation.
 * @param {readonly string[]} absentNpcIds - Persistent overrides that suppress every normal spawn.
 * @returns {ResolvedNpcPlacement[]} The result described by the TypeScript return signature.
 */
export function resolveNpcPlacements(
  definitions: Readonly<Record<string, NpcDefinition>>,
  locations: readonly TravelLocation[],
  locationId: string,
  phase: DayPhase,
  absentNpcIds: readonly string[] = [],
): ResolvedNpcPlacement[] {
  return Object.entries(definitions).flatMap(([type, definition]) => {
    if (absentNpcIds.includes(type)) return []
    const homes = locations.filter(location => location.npc?.type === type)
    const scheduled = definition.schedule?.[phase]
    if (scheduled) {
      const home = homes[0]?.npc
      if (home?.enabled === false || scheduled.enabled === false || scheduled.locationId !== locationId) return []

      return [{
        type, x: scheduled.x, scale: scheduled.scale ?? home?.scale ?? 1,
        ...(scheduled.buildingId ? { buildingId: scheduled.buildingId } : {}),
        ...(scheduled.roomId ? { roomId: scheduled.roomId } : {}),
        ...(scheduled.floor !== undefined ? { floor: scheduled.floor } : {}),
      }]
    }

    return homes.filter(location => location.id === locationId && location.npc?.enabled !== false)
      .map(location => ({ type, x: location.npc!.x, scale: location.npc!.scale ?? 1 }))
  })
}
