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
  private returnTo?: { x: number; y: number; scale: number }

  constructor(scene: Phaser.Scene, building: BuildingDefinition, left: number, groundY: number) {
    this.rooms = (building.rooms ?? []).map(binding => new Room(scene, binding, ROOMS[binding.type], building, left, groundY))
    const { crop, groundY: innerGround } = building.inner
    const color = GAME_SETTINGS.roomShade
    this.shade = scene.add.rectangle(left + crop.x * building.scale, groundY + (crop.y - innerGround) * building.scale,
      crop.width * building.scale, crop.height * building.scale, color.color, color.alpha)
      .setOrigin(0).setDepth(WORLD_LAYERS.roomShade).setVisible(false)
    this.hint = createWorldHint(scene, 0, 0, '')
    this.radius = building.interactionRadius
  }

  get isInside(): boolean { return this.active !== undefined }
  get activeId(): string | undefined { return this.active?.door.id }
  get spaces() { return this.rooms.map(room => room.space) }
  get patrolSpaces() { return this.rooms.map(room => ({ roomId: room.door.id, floor: room.door.floor,
    groundY: room.door.y, bounds: room.bounds, clearance: room.door.y - room.bounds.ceiling })) }
  canExit(hero: Hero): boolean {
    return this.active !== undefined && hero.canInteract && isNearEntrance(hero.sprite, this.active.door, GAME_SETTINGS.roomExitRadius)
  }
  get bounds() { return this.active?.bounds }
  get platforms() { return this.active?.platforms ?? [] }

  private show(room?: Room): void {
    this.active = room
    this.shade.setVisible(room !== undefined)
    for (const candidate of this.rooms) candidate.setVisible(candidate === room)
  }

  hideHint(): void { this.hint.setVisible(false) }

  enter(roomId: string, hero: Hero, x?: number): number {
    const room = this.rooms.find(candidate => candidate.door.id === roomId)
    if (!room) throw new Error(`Unknown room: ${roomId}`)
    // Always restore the room's corridor door, including when starting directly indoors.
    this.returnTo = { x: room.door.x, y: room.door.y, scale: hero.sprite.scaleX }
    this.show(room)
    this.hideHint()
    hero.sprite.setScale(HERO_SETTINGS.roomScale)
    hero.standAt(x === undefined ? room.door.x : room.space.x + x * room.space.scale, room.door.y)
    return room.door.floor
  }

  leave(hero: Hero): void {
    if (this.returnTo) {
      hero.sprite.setScale(this.returnTo.scale)
      hero.standAt(this.returnTo.x, this.returnTo.y)
    }
    this.returnTo = undefined
    this.show()
    this.hideHint()
  }

  update(hero: Hero, actions: InputActions, floor: number, locks?: LockpickingController, buildingId = ''): boolean {
    const wasInside = this.isInside
    const door = this.active?.door ?? nearestRoomDoor(this.rooms.map(room => room.door), floor, hero.sprite, this.radius)
    const near = door && hero.canInteract && isNearEntrance(hero.sprite, door, this.active ? GAME_SETTINGS.roomExitRadius : this.radius)
    this.hint.setVisible(Boolean(near))
    if (near) {
      const room = this.active ?? this.rooms.find(candidate => candidate.door.id === door.id)!
      this.hint.setText(`Enter · ${this.active ? 'Leave' : locks?.isLocked(`${buildingId}:${door.id}`, door.id) ? 'Lockpick' : 'Open'} ${room.definition.name}`)
        .setPosition(hero.sprite.x, hero.sprite.y - hero.sprite.displayHeight - GAME_SETTINGS.interaction.hintGap)
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
