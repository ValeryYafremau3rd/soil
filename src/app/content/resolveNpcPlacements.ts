import type { DayPhase } from '../contracts/daytime'
import type { TravelLocation } from '../contracts/travel'
import type { NpcDefinition } from '../../content/types'

export interface ResolvedNpcPlacement { type: string; x: number; scale: number; buildingId?: string; roomId?: string; floor?: number }

/** Resolve the whole roster so scheduled NPCs can appear outside their home district. */
export function resolveNpcPlacements(definitions: Readonly<Record<string, NpcDefinition>>,
  locations: readonly TravelLocation[], locationId: string, phase: DayPhase): ResolvedNpcPlacement[] {
  return Object.entries(definitions).flatMap(([type, definition]) => {
    const homes = locations.filter(location => location.npc?.type === type)
    const scheduled = definition.schedule?.[phase]
    if (scheduled) {
      const home = homes[0]?.npc
      if (home?.enabled === false || scheduled.enabled === false || scheduled.locationId !== locationId) return []
      return [{ type, x: scheduled.x, scale: scheduled.scale ?? home?.scale ?? 1,
        ...(scheduled.buildingId ? { buildingId: scheduled.buildingId } : {}),
        ...(scheduled.roomId ? { roomId: scheduled.roomId } : {}),
        ...(scheduled.floor !== undefined ? { floor: scheduled.floor } : {}),
      }]
    }
    return homes.filter(location => location.id === locationId && location.npc?.enabled !== false)
      .map(location => ({ type, x: location.npc!.x, scale: location.npc!.scale ?? 1 }))
  })
}
