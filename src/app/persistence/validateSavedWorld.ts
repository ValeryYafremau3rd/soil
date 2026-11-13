import { DAYTIME_CONFIG } from '../../content/daytime.ts'
import type { SaveGame } from '../contracts/save'
import { checkSave as check } from './checkSave.ts'
import type { SaveReferences } from './saveReferences.ts'

export function validateSavedWorld(save: SaveGame, references: SaveReferences): void {
check(save.travel.phaseTravels < references.travelsPerPhase * (save.daytime.phase === 'night' ? DAYTIME_CONFIG.nightDurationMultiplier : 1))
const location = references.locations.find(candidate => candidate.id === save.travel.locationId)
check(location && save.position.locationId === location.id)
const position = save.position
if (position.buildingId) {
    const instance = location!.buildings.find(building => building.id === position.buildingId && building.enabled !== false)
    check(instance)
    const building = references.buildings[instance!.type]
    check(position.floor !== undefined && position.floor < building.inner.floors.length)
    if (position.roomId) check(building.rooms?.some(room => room.id === position.roomId && room.floor === position.floor))
  } else check(position.roomId === undefined && position.floor === undefined)
const doors = new Set(references.locations.flatMap(entry => entry.buildings.flatMap(instance => [instance.id,
    ...(references.buildings[instance.type].rooms ?? []).map(room => `${instance.id}:${room.id}`)])))
for (const key of save.unlockedDoors) {
    const separator = key.indexOf(':')
    const day = Number(key.slice(0, separator))
    check(separator > 0 && Number.isSafeInteger(day) && day > 0 && day <= save.daytime.day && doors.has(key.slice(separator + 1)))
  }
}
