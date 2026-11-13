import type { LockpickingController } from '../../app/contracts/lockpicking'
import { HERO_SETTINGS } from '../../content/hero'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import type { Building, BuildingTransition } from './Building'
import type { PlayerPosition } from '../../app/contracts/save'

export class BuildingManager {
  private readonly buildings: readonly Building[]

  constructor(buildings: readonly Building[]) { this.buildings = buildings }

  private get active(): Building | undefined { return this.buildings.find(building => building.isInside) }
  get isInside(): boolean { return this.active !== undefined }
  get activeId(): string | undefined { return this.active?.id }
  get activeFloor(): number | undefined { return this.active?.activeFloor }
  restorePosition(position: PlayerPosition, hero: Hero): void {
    if (!position.buildingId) return
    const building = this.buildings.find(candidate => candidate.id === position.buildingId)!
    if (position.roomId) building.enterRoom(position.roomId, hero, 0)
    else building.restoreFloor(hero, position.floor ?? 0)
    for (const candidate of this.buildings) candidate.setForeground(candidate === building)
  }
  get isInRoom(): boolean { return this.active?.isInRoom ?? false }
  get activeRoomId(): string | undefined { return this.active?.activeRoomId }
  get roomSpaces() { return this.buildings.flatMap(building => building.roomSpaces) }
  get patrolSpaces() { return this.buildings.flatMap(building => building.patrolSpaces) }
  canExitRoom(hero: Hero): boolean { return this.active?.canExitRoom(hero) ?? false }
  get platforms() { return this.active ? this.active.platforms : this.buildings.flatMap(building => building.platforms) }

  enterRoom(buildingId: string, roomId: string, hero: Hero, x: number): void {
    const building = this.buildings.find(candidate => candidate.id === buildingId)
    if (!building) throw new Error(`Unknown building instance: ${buildingId}`)
    building.enterRoom(roomId, hero, x)
    for (const candidate of this.buildings) candidate.setForeground(candidate === building)
  }

  interiorFloorY(id: string, floor: number): number {
    const building = this.buildings.find(candidate => candidate.id === id)
    if (!building) throw new Error(`Unknown building instance: ${id}`)
    return building.interiorFloorY(floor)
  }

  movementBounds(worldWidth: number) {
    return this.active?.movementBounds(worldWidth) ?? {
      left: HERO_SETTINGS.edgeMargin, right: worldWidth - HERO_SETTINGS.edgeMargin, ceiling: 0,
    }
  }

  private syncForeground(): void {
    const active = this.active
    for (const building of this.buildings) building.setForeground(!active || building === active)
  }

  update(hero: Hero, delta: number, actions: InputActions, locks: LockpickingController, transition?: BuildingTransition): boolean {
    const target = this.active ?? [...this.buildings].sort((a, b) =>
      a.entranceDistance(hero.sprite.x) - b.entranceDistance(hero.sprite.x))[0]
    let onStairs = false
    const transitionView: BuildingTransition | undefined = transition && ((name, entering, change) => transition(name, entering, () => {
      change()
      this.syncForeground()
    }))
    for (const building of this.buildings) onStairs = building.update(hero, delta, actions, !this.active || building === target, locks, transitionView) || onStairs
    this.syncForeground()
    return onStairs
  }
}
