import type { LockpickingController } from '../../app/contracts/lockpicking'
import { HERO_SETTINGS } from '../../content/hero'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import type { Building, BuildingTransition } from './Building'
import type { PlayerPosition } from '../../app/contracts/save'

/**
 * Owns building manager state and behavior.
 */
export class BuildingManager {
  private readonly buildings: readonly Building[]

  /**
   * Initialize the BuildingManager instance and its collaborators.
   * @param {readonly Building[]} buildings - The buildings supplied to this operation.
   * @returns {BuildingManager} The initialized instance.
   */
  constructor(buildings: readonly Building[]) {
    this.buildings = buildings
  }

  /**
   * Perform active for BuildingManager.
   * @returns {Building | undefined} The result described by the TypeScript return signature.
   */
  private get active(): Building | undefined {
    return this.buildings.find(building => building.isInside)
  }

  /**
   * Check whether inside is true.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get isInside(): boolean {
    return this.active !== undefined
  }

  /**
   * Perform active id for BuildingManager.
   * @returns {string | undefined} The result described by the TypeScript return signature.
   */
  get activeId(): string | undefined {
    return this.active?.id
  }

  /**
   * Perform active floor for BuildingManager.
   * @returns {number | undefined} The result described by the TypeScript return signature.
   */
  get activeFloor(): number | undefined {
    return this.active?.activeFloor
  }

  /**
   * Restore position.
   * @param {PlayerPosition} position - The position supplied to this operation.
   * @param {Hero} hero - The hero supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  restorePosition(
    position: PlayerPosition,
    hero: Hero
  ): void {
    if (!position.buildingId) return

    const building = this.buildings.find(candidate => candidate.id === position.buildingId)!
    if (position.roomId) building.enterRoom(position.roomId, hero, 0)
    else building.restoreFloor(hero, position.floor ?? 0)

    for (const candidate of this.buildings) candidate.setForeground(candidate === building)
  }

  /**
   * Check whether in room is true.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get isInRoom(): boolean {
    return this.active?.isInRoom ?? false
  }

  /**
   * Perform active room id for BuildingManager.
   * @returns {string | undefined} The result described by the TypeScript return signature.
   */
  get activeRoomId(): string | undefined {
    return this.active?.activeRoomId
  }

  /**
   * Perform room spaces for BuildingManager.
   * @returns {{ buildingId: string; id: string; definition: RoomDefinition; x: number; groundY: number; scale: number; }[]} The result described by the TypeScript return signature.
   */
  get roomSpaces() {
    return this.buildings.flatMap(building => building.roomSpaces)
  }

  /**
   * Perform patrol spaces for BuildingManager.
   * @returns {object} The result described by the TypeScript return signature.
   */
  get patrolSpaces() {
    return this.buildings.flatMap(building => building.patrolSpaces)
  }

  /**
   * Check whether exit room is allowed.
   * @param {Hero} hero - The hero supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canExitRoom(hero: Hero): boolean {
    return this.active?.canExitRoom(hero) ?? false
  }

  /**
   * Perform platforms for BuildingManager.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    return this.active ? this.active.platforms : this.buildings.flatMap(building => building.platforms)
  }

  /**
   * Perform enter room for BuildingManager.
   * @param {string} buildingId - The building id supplied to this operation.
   * @param {string} roomId - The room id supplied to this operation.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {number} x - Horizontal coordinate.
   * @returns {void} Completes the operation without returning a value.
   */
  enterRoom(
    buildingId: string,
    roomId: string,
    hero: Hero,
    x: number
  ): void {
    const building = this.buildings.find(candidate => candidate.id === buildingId)
    if (!building) throw new Error(`Unknown building instance: ${buildingId}`)

    building.enterRoom(roomId, hero, x)

    for (const candidate of this.buildings) candidate.setForeground(candidate === building)
  }

  /**
   * Perform interior floor y for BuildingManager.
   * @param {string} id - The id supplied to this operation.
   * @param {number} floor - The floor supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  interiorFloorY(id: string, floor: number): number {
    const building = this.buildings.find(candidate => candidate.id === id)
    if (!building) throw new Error(`Unknown building instance: ${id}`)

    return building.interiorFloorY(floor)
  }

  /**
   * Perform movement bounds for BuildingManager.
   * @param {number} worldWidth - The world width supplied to this operation.
   * @returns {MovementBounds} The result described by the TypeScript return signature.
   */
  movementBounds(worldWidth: number) {
    return this.active?.movementBounds(worldWidth) ?? {
      left: HERO_SETTINGS.edgeMargin,
      right: worldWidth - HERO_SETTINGS.edgeMargin,
      ceiling: 0,
    }
  }

  /**
   * Perform sync foreground for BuildingManager.
   * @returns {void} Completes the operation without returning a value.
   */
  private syncForeground(): void {
    const active = this.active

    for (const building of this.buildings) building.setForeground(!active || building === active)
  }

  /**
   * Perform update for BuildingManager.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {number} delta - Elapsed time since the previous update.
   * @param {InputActions} actions - The actions supplied to this operation.
   * @param {LockpickingController} locks - The locks supplied to this operation.
   * @param {BuildingTransition | undefined} transition - The transition supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  update(
    hero: Hero,
    delta: number,
    actions: InputActions,
    locks: LockpickingController,
    transition?: BuildingTransition
  ): boolean {
    const target = this.active ?? [...this.buildings].sort((a, b) =>
      a.entranceDistance(hero.sprite.x) - b.entranceDistance(hero.sprite.x))[0]
    let onStairs = false
    const transitionView: BuildingTransition | undefined = transition && ((name, entering, change) => transition(name, entering, () => {
      change()
      this.syncForeground()
    }))

    for (const building of this.buildings) onStairs = building.update(
      hero,
      delta,
      actions,
      !this.active || building === target,
      locks,
      transitionView
    ) || onStairs

    this.syncForeground()

    return onStairs
  }
}
