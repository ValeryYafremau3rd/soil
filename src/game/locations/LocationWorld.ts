import type Phaser from 'phaser'
import type { DayPhase } from '../../app/contracts/daytime'
import type { GameServices } from '../../app/contracts/game'
import type { TravelLocation } from '../../app/contracts/travel'
import { isGameplayBlocked } from '../../app/services/session/isGameplayBlocked'
import { DAYTIME_CONFIG } from '../../content/daytime'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'
import { BuildingManager } from '../buildings/BuildingManager'
import { ContainerManager } from '../containers/ContainerManager'
import { CorpseManager } from '../containers/CorpseManager'
import { LootContainer } from '../containers/LootContainer'
import type { DialogueNpc } from '../entities/DialogueNpc'
import { Hero } from '../entities/Hero'
import { PatrolManager } from '../entities/PatrolManager'
import { FurnitureManager } from '../furniture/FurnitureManager'
import { KeyboardMouseInput } from '../input/KeyboardMouseInput'
import { BoundaryTravel } from '../interactive/BoundaryTravel'
import { BusStop } from '../interactive/BusStop'
import { StoryWorld } from '../interactive/StoryWorld'
import { WeatherOverlay } from '../rendering/WeatherOverlay'
import { setObjectLightPhase } from '../rendering/createObjectLight'
import { Taskboard } from '../taskboards/Taskboard'
import { TaskboardManager } from '../taskboards/TaskboardManager'
import { createLocationEntities, createLocationNpcs, preloadLocationEntities } from './locationEntities'
import { LocationCombatController } from './world/LocationCombatController'
import { LocationUpdateLoop } from './world/LocationUpdateLoop'
import { createWorldBackdrop } from './world/createWorldBackdrop'
import { createWorldHero } from './world/createWorldHero'

/** Composes one location; managers own geometry, proximity, and container visibility. */
export class LocationWorld {
  private readonly combat: LocationCombatController
  private readonly frame: LocationUpdateLoop
  private readonly storyWorld: StoryWorld
  private readonly weather: WeatherOverlay
  private readonly services: GameServices
  private readonly hero: Hero
  private readonly controls: KeyboardMouseInput
  private readonly buildings: BuildingManager
  private readonly busStop: BusStop
  private npcs: readonly DialogueNpc[]
  private readonly daytimeTint: Phaser.GameObjects.Rectangle
  private readonly containers: ContainerManager
  private readonly taskboards: TaskboardManager
  private readonly boundaryTravel: BoundaryTravel
  private patrols: PatrolManager
  private readonly corpses: CorpseManager
  private readonly furniture: FurnitureManager
  private readonly scene: Phaser.Scene
  private readonly location: TravelLocation
  private readonly groundY: number
  private phase: DayPhase
  private day: number
  private readonly width: number

  /**
   * Perform hero death complete for LocationWorld.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  get heroDeathComplete(): boolean {
    return this.hero.deathAnimationComplete
  }

  /**
   * Perform preload for LocationWorld.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {TravelLocation} location - The location supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  static preload(
    scene: Phaser.Scene,
    location: TravelLocation
  ): void {
    const { key, path } = location.background
    if (!scene.textures.exists(key)) scene.load.image(key, `${import.meta.env.BASE_URL}${path}`)

    Hero.preload(scene)
    preloadLocationEntities(scene, location)
    BusStop.preload(scene)
    LootContainer.preload(scene)
    Taskboard.preload(scene)
    PatrolManager.preload(scene)
    FurnitureManager.preload(scene)
  }

  /**
   * Initialize the LocationWorld instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {TravelLocation} location - The location supplied to this operation.
   * @param {GameServices} services - The services supplied to this operation.
   * @returns {LocationWorld} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    location: TravelLocation,
    services: GameServices
  ) {
    this.services = services
    this.combat = new LocationCombatController({
      scene, services,
      getHero: () => this.hero,
      getPatrols: () => this.patrols,
      blocked: () => isGameplayBlocked(services),
    })
    services.rest.setCombatActive(false)
    this.scene = scene
    this.location = location
    this.phase = services.daytime.getSnapshot().phase
    this.day = services.daytime.getSnapshot().day
    this.boundaryTravel = new BoundaryTravel(services.travel)
    const { width, groundY, height } = createWorldBackdrop(scene, location)
    this.width = width
    this.groundY = groundY
    const entities = createLocationEntities(
      scene,
      location,
      groundY,
      services.dialogue,
      services.daytime.getSnapshot().phase,
      services.quests,
      services.story
    )
    this.buildings = new BuildingManager(entities.buildings)
    this.storyWorld = new StoryWorld(scene, location, groundY, this.buildings, services.story)
    this.corpses = new CorpseManager(scene, location.id, services.inventory)
    this.npcs = entities.npcs
    this.busStop = new BusStop(scene, location, groundY, services.travel)
    this.busStop.sprite.setDepth(WORLD_LAYERS.actors)
    this.containers = new ContainerManager(scene, location.id, groundY, services.inventory, this.buildings)
    this.taskboards = new TaskboardManager(scene, location.id, groundY, services.quests, this.buildings)
    this.furniture = new FurnitureManager(
      scene,
      location.id,
      groundY,
      this.buildings,
      services.rest,
      services.vehicles.open,
      /**
       * Credit training only after the furniture accepts a hide action.
       * @returns {void} Records hiding without requiring an earlier pursuit.
       */
      () => services.quests.recordAction('objectHidden')
    )
    this.hero = createWorldHero({
      scene, location, groundY, width: this.width, services, combat: this.combat,
    })
    this.controls = new KeyboardMouseInput(scene)
    const filter = DAYTIME_CONFIG.phases[services.daytime.getSnapshot().phase].filter
    // Outdoor light covers the world while leaving interaction prompts readable.
    this.daytimeTint = scene.add.rectangle(0, 0, this.width, height, filter.color, filter.alpha)
      .setOrigin(0).setDepth(WORLD_LAYERS.daytimeTint)
    this.weather = new WeatherOverlay(scene)
    setObjectLightPhase(scene, this.phase)
    // Only a new session uses the authored room spawn; travel uses its arrival point.
    if (services.travel.getSnapshot().journey === 0 && location.initialSpawn) {
      const spawn = location.initialSpawn
      this.buildings.enterRoom(spawn.buildingId, spawn.roomId, this.hero, spawn.x)
    }

    const loadedPosition = services.options.takeLoadedPosition()
    if (loadedPosition && loadedPosition.locationId === location.id) {
      this.buildings.restorePosition(loadedPosition, this.hero)
      const bounds = this.buildings.movementBounds(this.width)
      this.hero.restoreAt(
        Math.max(bounds.left, Math.min(bounds.right, loadedPosition.x)),
        loadedPosition.y
      )
    }

    this.patrols = new PatrolManager(
      scene,
      location.id,
      this.phase,
      groundY,
      this.width,
      this.damageHero,
      services.difficulty,
      this.buildings.patrolSpaces,
      this.damageFear,
      Math.random,
      this.corpses.add,
      this.services.perks.recordAction,
      { buildingId: this.buildings.activeId, roomId: this.buildings.activeRoomId },
      () => this.services.statistics.record('monstersKilled'),
      this.services.audio,
      this.day
    )
    this.savePosition()
    this.syncContext()
    const unsubscribeWeaponUse = services.inventory.subscribeWeaponUse((
      itemId,
      kind,
      held
    ) => {
      if (!held) {
        this.hero.releaseQuickAttack()

        return
      }

      if (isGameplayBlocked(services) || services.status.getSnapshot().health <= 0) return

      if (kind === 'shot' && !services.inventory.canShoot(itemId)) return

      this.hero.quickAttack(
        kind,
        (
          multiplier,
          charge
        ) => {
          if (!services.inventory.getSnapshot().items.some(item => item.itemId === itemId && item.quantity > 0) || !services.inventory.meetsItemRequirements(itemId)) return false

          return this.attack(kind, multiplier, itemId, charge)
        }
      )
    })
    scene.events.once('shutdown', unsubscribeWeaponUse)
    scene.cameras.main.startFollow(
      this.hero.sprite,
      true,
      GAME_SETTINGS.scene.cameraFollowX,
      GAME_SETTINGS.scene.cameraFollowY
    )
    this.frame = new LocationUpdateLoop({
      services, scene, hero: this.hero, controls: this.controls,
      buildings: this.buildings, weather: this.weather, containers: this.containers,
      taskboards: this.taskboards, furniture: this.furniture, busStop: this.busStop,
      corpses: this.corpses, width: this.width, boundaryTravel: this.boundaryTravel,
      storyWorld: this.storyWorld,
      getPatrols: () => this.patrols,
      getNpcs: () => this.npcs,
      getPhase: () => this.phase,
      syncTime: () => this.syncTime(),
      syncContext: () => this.syncContext(),
      savePosition: () => this.savePosition(),
      transitionBuilding: this.transitionBuilding,
    })
  }

  /**
   * Perform pause for LocationWorld.
   * @returns {void} Completes the operation without returning a value.
   */
  pause(): void {
    this.services.audio.setRunning(false)
    this.controls.setEnabled(false)
    this.hero.cancelAttackPreparation()
    this.scene.cameras.main.shakeEffect.reset()
  }

  /**
   * Advance the ordered world frame loop.
   * @param {number} delta - Elapsed gameplay milliseconds.
   * @returns {void} Updates scene-owned actors and interactions.
   */
  update(delta: number): void {
    this.frame.update(delta)
  }

  /**
   * Save position.
   * @returns {void} Completes the operation without returning a value.
   */
  private savePosition(): void {
    this.services.options.updatePosition({
      locationId: this.location.id,
      x: this.hero.sprite.x,
      y: this.hero.sprite.y,
      buildingId: this.buildings.activeId,
      roomId: this.buildings.activeRoomId,
      floor: this.buildings.activeFloor
    })
  }

  /**
   * Perform transition building for LocationWorld.
   * @param {string} name - The name supplied to this operation.
   * @param {boolean} entering - The entering supplied to this operation.
   * @param {() => void} change - The change supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private transitionBuilding = (name: string, entering: boolean, change: () => void): void => {
    const loading = this.services.loading
    if (!loading.begin(entering ? name : this.location.name)) return

    this.services.audio.cue('door')
    this.scene.time.delayedCall(loading.fadeMs, () => {
      loading.covered()
      change()
      this.syncContext()
      this.savePosition()
      loading.ready()
      this.scene.time.delayedCall(loading.fadeMs, loading.finish)
    })
  }

  /**
   * Perform damage hero for LocationWorld.
   * @param {number} amount - Amount to apply to the operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private damageHero = (amount: number): void => {
    return this.combat.damageHero(amount)
  }

  /**
   * Perform damage fear for LocationWorld.
   * @param {number} amount - Amount to apply to the operation.
   * @param {boolean} aura - The aura supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private damageFear = (amount: number, aura = false): void => {
    return this.combat.damageFear(amount, aura)
  }

  /**
   * Perform attack for LocationWorld.
   * @param {"melee" | "shot"} kind - The kind supplied to this operation.
   * @param {number} multiplier - Scaling factor applied to the base value.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @param {number} charge - The charge supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private attack(kind: 'melee' | 'shot', multiplier = 1, itemId?: string, charge = 0.5): boolean {
    return this.combat.attack(kind, multiplier, itemId, charge)
  }

  /**
   * Perform sync context for LocationWorld.
   * @returns {void} Completes the operation without returning a value.
   */
  private syncContext(): void {
    if (this.buildings.activeId && this.buildings.activeRoomId) {
      this.services.quests.visitRoom(
        this.location.id,
        this.buildings.activeId,
        this.buildings.activeRoomId
      )
    }

    this.busStop.sprite.setVisible(!this.buildings.isInside)
    // Keep outdoor lighting behind the occupied interior instead of darkening the street.
    this.daytimeTint.setDepth(this.buildings.isInside ? WORLD_LAYERS.interiorShade : WORLD_LAYERS.daytimeTint)

    for (const npc of this.npcs) npc.setContext(this.buildings.activeId, this.buildings.activeRoomId)

    this.patrols.setContext(
      this.buildings.activeId,
      this.buildings.activeFloor,
      this.buildings.activeRoomId
    )
    this.corpses.setContext(
      this.buildings.activeId,
      this.buildings.activeFloor,
      this.buildings.activeRoomId
    )
    this.containers.setInside(this.buildings.activeId, true, this.buildings.activeRoomId)
    this.taskboards.setInside(this.buildings.activeId, !this.buildings.isInRoom)
    this.furniture.setContext(this.buildings.activeId, this.buildings.activeRoomId)
  }

  /**
   * Perform sync time for LocationWorld.
   * @returns {void} Completes the operation without returning a value.
   */
  private syncTime(): void {
    const { phase, day } = this.services.daytime.getSnapshot()
    if (phase === this.phase && day === this.day) return

    this.phase = phase
    this.day = day
    setObjectLightPhase(this.scene, phase)
    const filter = DAYTIME_CONFIG.phases[phase].filter
    this.daytimeTint.setFillStyle(filter.color, filter.alpha)

    for (const npc of this.npcs) npc.destroy()

    this.npcs = createLocationNpcs(
      this.scene,
      this.location,
      this.groundY,
      this.services.dialogue,
      phase,
      this.services.quests,
      this.services.story
    )

    for (const npc of this.npcs) npc.setContext(this.buildings.activeId, this.buildings.activeRoomId)

    this.patrols.destroy()
    this.corpses.destroy()
    this.patrols = new PatrolManager(
      this.scene,
      this.location.id,
      phase,
      this.groundY,
      this.width,
      this.damageHero,
      this.services.difficulty,
      this.buildings.patrolSpaces,
      this.damageFear,
      Math.random,
      this.corpses.add,
      this.services.perks.recordAction,
      { buildingId: this.buildings.activeId, roomId: this.buildings.activeRoomId },
      () => this.services.statistics.record('monstersKilled'),
      this.services.audio,
      day
    )
    this.patrols.setContext(
      this.buildings.activeId,
      this.buildings.activeFloor,
      this.buildings.activeRoomId
    )
  }
}
