import type { LockpickingController } from '../../app/contracts/lockpicking'
import Phaser from 'phaser'
import type { BuildingDefinition, BuildingView } from '../../content/buildings'
import { HERO_SETTINGS } from '../../content/hero'
import { GAME_SETTINGS, WORLD_LAYERS, MINIMUM_INTERIOR_HEIGHT } from '../../content/world'
import { createWorldHint, isSelectedHint } from '../rendering/createWorldHint'
import { worldSurfaces } from '../physics/surfaces'
import { isNearEntrance, stairPosition, stairRoute } from '../../domain/buildings/navigation'
import type { Point } from '../../domain/buildings/navigation'
import { Hero } from '../entities/Hero'
import type { MovementBounds } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import { RoomManager } from './RoomManager'
import { createObjectLight } from '../rendering/createObjectLight'

interface StairTrip {
  start: Point
  landing: Point
  end: Point
  targetFloor: number
  elapsed: number
}

export type BuildingTransition = (name: string, entering: boolean, change: () => void) => void

export abstract class Building {
  readonly id: string
  protected get name(): string { return this.definition.name }
  protected readonly definition: BuildingDefinition
  private readonly image: Phaser.GameObjects.Image
  private readonly hint: Phaser.GameObjects.Text
  private readonly exitMarker: Phaser.GameObjects.Text
  private readonly rooms: RoomManager
  private readonly entrance: Point
  private readonly left: number
  private inside = false
  private floorIndex = 0
  private trip?: StairTrip

  constructor(scene: Phaser.Scene, id: string, definition: BuildingDefinition, entranceX: number, groundY: number) {
    this.id = id
    this.definition = definition
    this.entrance = { x: entranceX, y: groundY }
    this.left = entranceX - definition.entranceX * definition.scale
    this.image = scene.add.image(this.left, 0, definition.outer.key)
      .setOrigin(0).setScale(definition.scale).setDepth(WORLD_LAYERS.building)
    this.hint = createWorldHint(scene, entranceX, groundY - GAME_SETTINGS.interaction.hintOffset, '')
    const marker = GAME_SETTINGS.exitMarker
    this.exitMarker = createWorldHint(scene, entranceX, groundY - marker.offsetY, marker.label)
      .setStyle({ color: marker.color, backgroundColor: marker.backgroundColor, fontSize: marker.fontSize })
    this.rooms = new RoomManager(scene, definition, this.left, groundY)
    this.showView()
    for (const door of this.entrancePoints) createObjectLight(scene, 'entrance', () => ({ ...door,
      visible: !this.inside && this.image.depth === WORLD_LAYERS.building }))
    for (const [index, floor] of (definition.corridorLights === false ? [] : definition.inner.floors).entries()) {
      createObjectLight(scene, 'corridor', () => ({
        x: this.left + (floor.left + floor.right) / 2 * definition.scale,
        y: this.interiorFloorY(index), visible: this.inside && !this.rooms.isInside,
      }))
    }
  }

  private get view(): BuildingView {
    return this.inside ? this.definition.inner : this.definition.outer
  }

  get isInside(): boolean {
    return this.inside
  }

  get entranceX(): number { return this.entrance.x }
  get entrancePoints(): readonly Point[] {
    return (this.definition.entrances ?? [this.definition.entranceX]).map(x => ({
      x: this.left + x * this.definition.scale, y: this.entrance.y,
    }))
  }
  private get stairs() {
    return this.definition.stairs ?? this.definition.inner.floors.slice(1).map((_, index) => ({
      fromFloor: index, toFloor: index + 1, fromX: this.definition.stairX,
      toX: this.definition.stairX, landingX: this.definition.stairLandingX,
    }))
  }
  entranceDistance(x: number): number { return Math.min(...this.entrancePoints.map(door => Math.abs(door.x - x))) }
  get activeFloor(): number { return this.floorIndex }
  get patrolSpaces() {
    return [...this.rooms.patrolSpaces.map(space => ({ ...space, buildingId: this.id })), ...this.definition.inner.floors.map((floor, index) => ({ buildingId: this.id, floor: index,
      groundY: this.interiorFloorY(index), clearance: Math.max((floor.y - floor.ceiling) * this.definition.scale, MINIMUM_INTERIOR_HEIGHT),
      bounds: { left: this.worldPoint(floor.left, floor.y).x + HERO_SETTINGS.edgeMargin,
        right: this.worldPoint(floor.right, floor.y).x - HERO_SETTINGS.edgeMargin } }))]
  }
  restoreFloor(hero: Hero, floor: number): void {
    this.enter(hero)
    this.floorIndex = floor
    hero.standAt(this.entrance.x, this.interiorFloorY(floor))
  }
  get isInRoom(): boolean { return this.rooms.isInside }
  get activeRoomId(): string | undefined { return this.rooms.activeId }
  get roomSpaces() { return this.rooms.spaces.map(space => ({ ...space, buildingId: this.id })) }
  canExitRoom(hero: Hero): boolean { return this.rooms.canExit(hero) }
  get platforms() { return this.rooms.isInside ? this.rooms.platforms : worldSurfaces(this.id, this.image.getBounds(), this.view.platforms) }

  interiorFloorY(index: number): number {
    const floor = this.definition.inner.floors[index]
    if (!floor) throw new Error(`Unknown floor ${index} in building ${this.id}`)
    return this.entrance.y + (floor.y - this.definition.inner.groundY) * this.definition.scale
  }

  setForeground(foreground: boolean): void {
    this.image.setDepth(foreground ? WORLD_LAYERS.building : WORLD_LAYERS.outdoors)
  }

  private worldPoint(x: number, y: number): Point {
    return {
      x: this.left + x * this.definition.scale,
      y: this.entrance.y + (y - this.view.groundY) * this.definition.scale,
    }
  }

  private showView(): void {
    // Pin the exit to its actual ground-floor interaction point, independently of hero proximity.
    this.exitMarker.setVisible(this.inside)
    const { crop, key, groundY } = this.view
    this.image.setTexture(key).setPosition(this.left, this.entrance.y - groundY * this.definition.scale)
      .setCrop(crop.x, crop.y, crop.width, crop.height)
  }

  movementBounds(worldWidth: number): MovementBounds {
    if (this.rooms.bounds) return this.rooms.bounds
    if (!this.inside) return {
      left: HERO_SETTINGS.edgeMargin, right: worldWidth - HERO_SETTINGS.edgeMargin, ceiling: 0,
    }
    const floor = this.view.floors[this.floorIndex]
    return {
      left: this.worldPoint(floor.left, floor.y).x + HERO_SETTINGS.edgeMargin,
      right: this.worldPoint(floor.right, floor.y).x - HERO_SETTINGS.edgeMargin,
      ceiling: Math.min(this.worldPoint(floor.left, floor.ceiling).y, this.interiorFloorY(this.floorIndex) - MINIMUM_INTERIOR_HEIGHT),
    }
  }

  enter(hero: Hero, entranceX = this.entrance.x): void {
    this.inside = true
    this.floorIndex = 0
    this.showView()
    hero.sprite.setScale(HERO_SETTINGS.roomScale)
    hero.standAt(entranceX, this.entrance.y)
  }

  exit(hero: Hero, entranceX = this.entrance.x): void {
    this.rooms.leave(hero)
    this.inside = false
    this.floorIndex = 0
    this.trip = undefined
    this.showView()
    hero.sprite.setScale(HERO_SETTINGS.scale)
    hero.standAt(entranceX, this.entrance.y)
  }

  enterRoom(roomId: string, hero: Hero, x: number): void {
    this.enter(hero)
    this.floorIndex = this.rooms.enter(roomId, hero, x)
    this.exitMarker.setVisible(false)
  }

  private useStairs(hero: Hero, direction: number): void {
    if (!this.inside || !hero.canInteract || direction === 0) return
    const route = stairRoute(this.stairs, this.floorIndex, direction, (hero.sprite.x - this.left) / this.definition.scale,
      this.definition.interactionRadius / this.definition.scale)
    if (!route) return
    const start = { x: hero.sprite.x, y: hero.sprite.y }
    const end = this.worldPoint(route.toX, this.view.floors[route.targetFloor].y)
    this.trip = {
      start, end, targetFloor: route.targetFloor, elapsed: 0,
      landing: { x: this.worldPoint(route.landingX, 0).x, y: (start.y + end.y) / 2 },
    }
  }

  // Returns true while the staircase owns the hero's movement.
  update(hero: Hero, delta: number, actions: InputActions, enabled = true, locks?: LockpickingController,
    transition?: BuildingTransition): boolean {
    if (!enabled) { this.hint.setVisible(false); this.rooms.hideHint(); return false }
    if (this.inside && !this.trip && this.rooms.update(hero, actions, this.floorIndex, locks, this.id)) {
      this.hint.setVisible(false)
      this.exitMarker.setVisible(!this.rooms.isInside)
      return false
    }
    if (!this.inside || this.trip) this.rooms.hideHint()
    const door = [...this.entrancePoints].sort((a, b) => Math.abs(a.x - hero.sprite.x) - Math.abs(b.x - hero.sprite.x))[0]
    if (this.inside) this.exitMarker.setX(door.x)
    const nearDoor = (!this.inside || this.floorIndex === 0) && isNearEntrance(
      hero.sprite, door, this.definition.interactionRadius,
    )
    if (!this.trip && hero.canInteract && (actions.interactPressed && isSelectedHint(this.hint)) && nearDoor) {
      const entering = !this.inside
      if (entering && locks && !locks.attempt(this.id, this.name)) return false
      const change = () => { if (entering) this.enter(hero, door.x); else this.exit(hero, door.x) }
      this.hint.setVisible(false)
      if (transition) transition(this.name, entering, change)
      else change()
      return false
    }
    if (!this.trip) this.useStairs(hero, actions.stairsDirection)
    if (this.trip) {
      this.trip.elapsed += Math.min(delta, HERO_SETTINGS.maxDeltaMs)
      const progress = this.trip.elapsed / this.definition.stairDurationMs
      const position = stairPosition(this.trip.start, this.trip.landing, this.trip.end, progress)
      hero.climbTo(position.x, position.y)
      if (progress >= 1) {
        this.floorIndex = this.trip.targetFloor
        hero.standAt(this.trip.end.x, this.trip.end.y)
        this.trip = undefined
      }
      this.hint.setVisible(false)
      return true
    }
    const localX = (hero.sprite.x - this.left) / this.definition.scale
    const radius = this.definition.interactionRadius / this.definition.scale
    const nearStairs = this.inside && (stairRoute(this.stairs, this.floorIndex, 1, localX, radius)
      || stairRoute(this.stairs, this.floorIndex, -1, localX, radius))
    const text = nearDoor ? `Enter · ${this.inside ? 'Leave' : locks?.isLocked(this.id) ? 'Lockpick' : 'Enter'} ${this.name}`
      : nearStairs ? `${this.definition.stairs ? 'Stairs' : `Floor ${this.floorIndex + 1}`} · W up / S down` : ''
    this.hint.setText(text).setVisible(text.length > 0)
      .setPosition(hero.sprite.x, hero.sprite.y - hero.sprite.displayHeight - GAME_SETTINGS.interaction.hintGap)
    return false
  }
}

