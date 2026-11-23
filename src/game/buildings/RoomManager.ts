import type { LockpickingController } from '../../app/contracts/lockpicking'
import type Phaser from 'phaser'
import type { BuildingDefinition } from '../../content/types'
import { ROOMS } from '../../content/rooms'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'
import { HERO_SETTINGS } from '../../content/hero'
import { nearestRoomDoor } from '../../domain/buildings/rooms'
import { isNearEntrance } from '../../domain/buildings/navigation'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { createWorldHint, isSelectedHint } from '../rendering/createWorldHint'
import { Room } from './Room'

/** Owns the selected room and the corridor position restored when leaving it. */
export class RoomManager {
  private readonly rooms: readonly Room[]
  private readonly shade: Phaser.GameObjects.Rectangle
  private readonly hint: Phaser.GameObjects.Text
  private readonly radius: number
  private active?: Room
  private returnTo?: {
    x: number
    y: number
    scale: number
  }

  /**
   * Initialize the RoomManager instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {BuildingDefinition} building - The building supplied to this operation.
   * @param {number} left - The left supplied to this operation.
   * @param {number} groundY - The ground y supplied to this operation.
   * @returns {RoomManager} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    building: BuildingDefinition,
    left: number,
    groundY: number
  ) {
    this.rooms = (building.rooms ?? []).map(binding => new Room(scene, binding, ROOMS[binding.type], building, left, groundY))
    const { crop, groundY: innerGround } = building.inner
    const color = GAME_SETTINGS.roomShade
    this.shade = scene.add.rectangle(
      left + crop.x * building.scale,
      groundY + (crop.y - innerGround) * building.scale,
      crop.width * building.scale,
      crop.height * building.scale,
      color.color,
      color.alpha
    )
      .setOrigin(0).setDepth(WORLD_LAYERS.roomShade).setVisible(false)
    this.hint = createWorldHint(scene, 0, 0, '')
    this.radius = building.interactionRadius
  }

  /**
   * Check whether inside is true.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get isInside(): boolean {
    return this.active !== undefined
  }

  /**
   * Perform active id for RoomManager.
   * @returns {string | undefined} The result described by the TypeScript return signature.
   */
  get activeId(): string | undefined {
    return this.active?.door.id
  }

  /**
   * Perform spaces for RoomManager.
   * @returns {{ id: string; definition: RoomDefinition; x: number; groundY: number; scale: number; }[]} The result described by the TypeScript return signature.
   */
  get spaces() {
    return this.rooms.map(room => room.space)
  }

  /**
   * Perform patrol spaces for RoomManager.
   * @returns {object} The result described by the TypeScript return signature.
   */
  get patrolSpaces() {
    return this.rooms.map(room => ({
      roomId: room.door.id,
      floor: room.door.floor,
      groundY: room.door.y,
      bounds: room.bounds,
      clearance: room.door.y - room.bounds.ceiling
    }))
  }

  /**
   * Check whether exit is allowed.
   * @param {Hero} hero - The hero supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canExit(hero: Hero): boolean {
    return this.active !== undefined && hero.canInteract && isNearEntrance(hero.sprite, this.active.door, GAME_SETTINGS.roomExitRadius)
  }

  /**
   * Perform bounds for RoomManager.
   * @returns {{ left: number; right: number; ceiling: number; } | undefined} The result described by the TypeScript return signature.
   */
  get bounds() {
    return this.active?.bounds
  }

  /**
   * Perform platforms for RoomManager.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    return this.active?.platforms ?? []
  }

  /**
   * Perform show for RoomManager.
   * @param {Room | undefined} room - The room supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private show(room?: Room): void {
    this.active = room
    this.shade.setVisible(room !== undefined)

    for (const candidate of this.rooms) candidate.setVisible(candidate === room)
  }

  /**
   * Perform hide hint for RoomManager.
   * @returns {void} Completes the operation without returning a value.
   */
  hideHint(): void {
    this.hint.setVisible(false)
  }

  /**
   * Perform enter for RoomManager.
   * @param {string} roomId - The room id supplied to this operation.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {number | undefined} x - Horizontal coordinate.
   * @returns {number} The calculated numeric result.
   */
  enter(
    roomId: string,
    hero: Hero,
    x?: number
  ): number {
    const room = this.rooms.find(candidate => candidate.door.id === roomId)
    if (!room) throw new Error(`Unknown room: ${roomId}`)
    // Always restore the room's corridor door, including when starting directly indoors.
    this.returnTo = { x: room.door.x, y: room.door.y, scale: hero.sprite.scaleX }
    this.show(room)
    this.hideHint()
    hero.sprite.setScale(HERO_SETTINGS.roomScale)
    hero.standAt(
      x === undefined ? room.door.x : room.space.x + x * room.space.scale,
      room.door.y
    )

    return room.door.floor
  }

  /**
   * Perform leave for RoomManager.
   * @param {Hero} hero - The hero supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  leave(hero: Hero): void {
    if (this.returnTo) {
      hero.sprite.setScale(this.returnTo.scale)
      hero.standAt(this.returnTo.x, this.returnTo.y)
    }

    this.returnTo = undefined
    this.show()
    this.hideHint()
  }

  /**
   * Perform update for RoomManager.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {InputActions} actions - The actions supplied to this operation.
   * @param {number} floor - The floor supplied to this operation.
   * @param {LockpickingController | undefined} locks - The locks supplied to this operation.
   * @param {string} buildingId - The building id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  update(
    hero: Hero,
    actions: InputActions,
    floor: number,
    locks?: LockpickingController,
    buildingId = ''
  ): boolean {
    const wasInside = this.isInside
    const door = this.active?.door ?? nearestRoomDoor(this.rooms.map(room => room.door), floor, hero.sprite, this.radius)
    const near = door && hero.canInteract && isNearEntrance(
      hero.sprite,
      door,
      this.active ? GAME_SETTINGS.roomExitRadius : this.radius
    )
    this.hint.setVisible(Boolean(near))
    if (near) {
      const room = this.active ?? this.rooms.find(candidate => candidate.door.id === door.id)!
      this.hint.setText(`Enter · ${this.active ? 'Leave' : locks?.isLocked(`${buildingId}:${door.id}`, door.id) ? 'Lockpick' : 'Open'} ${room.definition.name}`)
        .setPosition(
          hero.sprite.x,
          hero.sprite.y - hero.sprite.displayHeight - GAME_SETTINGS.interaction.hintGap
        )
      const lockId = `${buildingId}:${door.id}`
      if ((actions.interactPressed && isSelectedHint(this.hint))) {
        this.hideHint()
        if (this.active) {
          this.leave(hero)
        } else {
          if (locks && !locks.attempt(lockId, room.definition.name, door.id)) return true

          const returnTo = { x: hero.sprite.x, y: hero.sprite.y, scale: hero.sprite.scaleX }
          this.enter(room.door.id, hero)
          this.returnTo = returnTo
        }

        return true
      }
    }

    return wasInside
  }
}
