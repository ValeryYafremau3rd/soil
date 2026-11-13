import type Phaser from 'phaser'
import type { TravelLocation } from '../../app/contracts/travel'
import type { GameServices } from '../../app/contracts/game'
import { isGameplayBlocked } from '../../app/services/isGameplayBlocked'
import { GAME_SETTINGS, WORLD_LAYERS } from '../../content/world'
import { BuildingManager } from '../buildings/BuildingManager'
import type { DialogueNpc } from '../entities/DialogueNpc'
import { Hero } from '../entities/Hero'
import { KeyboardMouseInput } from '../input/KeyboardMouseInput'
import { BusStop } from '../interactive/BusStop'
import { ContainerManager } from '../containers/ContainerManager'
import { LootContainer } from '../containers/LootContainer'
import { createLocationEntities, createLocationNpcs, preloadLocationEntities } from './locationEntities'
import { DAYTIME_CONFIG } from '../../content/daytime'
import { Taskboard } from '../taskboards/Taskboard'
import { TaskboardManager } from '../taskboards/TaskboardManager'
import type { DayPhase } from '../../app/contracts/daytime'
import { updateInteractiveObjects } from '../interactive/updateInteractiveObjects'
import { BoundaryTravel } from '../interactive/BoundaryTravel'
import { PatrolManager } from '../entities/PatrolManager'
import { CorpseManager } from '../containers/CorpseManager'
import { FurnitureManager } from '../furniture/FurnitureManager'
import { cycleWorldHint, clearWorldHints } from '../rendering/createWorldHint'
import { HERO_SETTINGS } from '../../content/hero'
import { ITEM_BY_ID } from '../../content/items'
import { resolveFearResistance } from '../../domain/inventory/items'
import { buffFearResistance, perkChargeDamage, chargePerkAction } from '../../domain/character/perks'
import { fearDamage } from '../../domain/combat/patrolCombat'
import { itemBuffMultiplier } from '../../domain/skills/effects'
import { movementEnergyCost } from '../../domain/movement/energy'
import { WeatherOverlay } from '../rendering/WeatherOverlay'
import { setObjectLightPhase } from '../rendering/createObjectLight'

/** Composes one location; managers own geometry, proximity, and container visibility. */
export class LocationWorld {
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
  get heroDeathComplete(): boolean { return this.hero.deathAnimationComplete }

  static preload(scene: Phaser.Scene, location: TravelLocation): void {
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

  constructor(scene: Phaser.Scene, location: TravelLocation, services: GameServices) {
    this.services = services
    services.rest.setCombatActive(false)
    this.scene = scene
    this.location = location
    this.phase = services.daytime.getSnapshot().phase
    this.day = services.daytime.getSnapshot().day
    this.boundaryTravel = new BoundaryTravel(services.travel)
    const background = scene.add.image(0, 0, location.background.key).setOrigin(0).setDepth(WORLD_LAYERS.background)
    const height = location.background.height * (location.background.scale ?? 1)
    background.setScale(height / background.height)
    // Slow horizontal scenery while retaining vertical ground alignment during jumps/stairs.
    background.setScrollFactor(location.background.scrollFactor ?? 1, 1)
    this.width = background.displayWidth
    const groundY = height * location.background.groundRatio
    this.groundY = groundY
    // Crop excess pavement below the ground instead of moving sprites off their authored floor.
    const bottomMargin = scene.cameras.main.height * (1 - GAME_SETTINGS.scene.groundScreenRatio)
    scene.cameras.main.setBounds(0, 0, this.width, Math.min(height, groundY + bottomMargin))
    const entities = createLocationEntities(scene, location, groundY, services.dialogue, services.daytime.getSnapshot().phase, services.quests)
    this.buildings = new BuildingManager(entities.buildings)
    this.corpses = new CorpseManager(scene, location.id, services.inventory)
    this.npcs = entities.npcs
    this.busStop = new BusStop(scene, location, groundY, services.travel)
    this.busStop.sprite.setDepth(WORLD_LAYERS.actors)
    this.containers = new ContainerManager(scene, location.id, groundY, services.inventory, this.buildings)
    this.taskboards = new TaskboardManager(scene, location.id, groundY, services.quests, this.buildings)
    this.furniture = new FurnitureManager(scene, location.id, groundY, this.buildings, services.rest)
    const arrivalEdge = services.travel.getSnapshot().arrivalEdge
    // Keep a full edge margin inside the destination so arrival cannot retrigger travel.
    const edgeSpawn = Math.min(HERO_SETTINGS.edgeMargin * 2, this.width / 2)
    const arrivalX = arrivalEdge === 'left' ? edgeSpawn : arrivalEdge === 'right' ? this.width - edgeSpawn
      : location.busStop.x + location.busStop.spawnOffset
    this.hero = new Hero(scene, arrivalX, groundY,
      (multiplier, charge) => this.attack('shot', multiplier, undefined, charge), (multiplier, charge) => this.attack('melee', multiplier, undefined, charge), this.damageHero, services.difficulty.hero.fallDamage,
      () => services.skillEffects.movement, services.inventory.canShoot,
      (distance, jumped) => {
        if (jumped) services.statistics.record('jumps')
        services.status.drain({ energy: movementEnergyCost(distance, jumped,
        HERO_SETTINGS.energyCosts, services.difficulty.modifiers.energyCost, services.character?.skills.athletics) }) },
      charge => perkChargeDamage(services.perks.getSnapshot(), services.perks.definitions, charge),
      distance => services.statistics.record('distance', distance))
    this.hero.sprite.setDepth(WORLD_LAYERS.hero)
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
      this.hero.restoreAt(Math.max(bounds.left, Math.min(bounds.right, loadedPosition.x)), loadedPosition.y)
    }
    this.patrols = new PatrolManager(scene, location.id, this.phase, groundY, this.width, this.damageHero,
      services.difficulty, this.buildings.patrolSpaces, this.damageFear, Math.random, this.corpses.add, this.services.perks.recordAction,
      { buildingId: this.buildings.activeId, roomId: this.buildings.activeRoomId },
      () => this.services.statistics.record('monstersKilled'))
    this.savePosition()
    this.syncContext()
    const unsubscribeWeaponUse = services.inventory.subscribeWeaponUse((itemId, kind, held) => {
      if (!held) { this.hero.releaseQuickAttack(); return }
      if (isGameplayBlocked(services) || services.status.getSnapshot().health <= 0) return
      if (kind === 'shot' && !services.inventory.canShoot(itemId)) return
      this.hero.quickAttack(kind, (multiplier, charge) => {
        if (!services.inventory.getSnapshot().items.some(item => item.itemId === itemId && item.quantity > 0) || !services.inventory.meetsItemRequirements(itemId)) return false
        return this.attack(kind, multiplier, itemId, charge)
      })
    })
    scene.events.once('shutdown', unsubscribeWeaponUse)
    scene.cameras.main.startFollow(this.hero.sprite, true, GAME_SETTINGS.scene.cameraFollowX, GAME_SETTINGS.scene.cameraFollowY)
  }

  pause(): void {
    this.controls.setEnabled(false)
    this.hero.cancelAttackPreparation()
    this.scene.cameras.main.shakeEffect.reset()
  }

  update(delta: number): void {
    this.syncTime()
    this.weather.update(delta, this.services.daytime.getSnapshot().weather ?? 'clear', this.buildings.isInside)
    if (isGameplayBlocked(this.services) || this.services.loading.getSnapshot().phase !== 'idle'
      || this.services.status.getSnapshot().health <= 0) this.scene.cameras.main.shakeEffect.reset()
    if (this.services.status.getSnapshot().health <= 0) {
      this.controls.setEnabled(false)
      this.patrols.pause()
      this.hero.die()
      return
    }
    const blocked = isGameplayBlocked(this.services) || this.services.status.getSnapshot().health <= 0
    this.controls.setEnabled(!blocked)
    if (!this.services.character || this.services.loading.getSnapshot().phase !== 'idle') {
      this.patrols.pause(); this.hero.cancelAttackPreparation(); this.hero.idle(); return
    }
    this.patrols.update(delta, {
      x: this.hero.sprite.x, y: this.hero.sprite.y, available: !this.hero.hiddenObjectId,
      hidden: Boolean(this.hero.hiddenObjectId),
      patrolPass: this.services.inventory.getSnapshot().items.some(stack => stack.quantity > 0 && ITEM_BY_ID[stack.itemId]?.patrolPass),
    }, this.services.skillEffects.detection, !blocked, this.services.character?.skills)
    this.services.rest.setCombatActive(this.patrols.inCombat, this.patrols.underFearAura({
      x: this.hero.sprite.x, y: this.hero.sprite.y, available: !this.hero.hiddenObjectId,
    }))
    const platforms = [...this.containers.platforms, ...this.taskboards.platforms, ...this.furniture.platforms, ...this.buildings.platforms,
      ...(!this.buildings.isInside ? this.busStop.platforms : [])]
    if (blocked) {
      this.hero.cancelAttackPreparation()
      const neutral = { direction: 0, jumpPressed: false, fightPressed: false, shootPressed: false,
        fightHeld: false, shootHeld: false, interactPressed: false, stairsDirection: 0 }
      const onStairs = this.buildings.update(this.hero, delta, neutral, this.services.lockpicking, this.transitionBuilding)
      this.syncContext()
      if (!onStairs) this.hero.update(delta, this.buildings.movementBounds(this.width), neutral, platforms)
      if (!onStairs && this.hero.canInteract) this.savePosition()
      return
    }
    const actions = this.controls.read()
    if (this.hero.hiddenObjectId) { clearWorldHints(this.scene); this.furniture.update(this.hero, actions); return }
    cycleWorldHint(this.scene, actions.optionDirection ?? 0)
    // Every nearby prompt participates in the shared Enter selection.
    if (this.furniture.update(this.hero, actions)
      || this.containers.update(this.hero, actions)
      || this.corpses.update(this.hero, actions)
      || this.taskboards.update(this.hero, actions)
      || this.busStop.update(this.hero, actions, !this.buildings.isInside && this.phase !== 'night')
      || updateInteractiveObjects(this.npcs, this.hero, actions)) {
      this.hero.idle()
      this.controls.setEnabled(false)
      return
    }
    const onStairs = this.buildings.update(this.hero, delta, actions, this.services.lockpicking, this.transitionBuilding)
    if (isGameplayBlocked(this.services)) {
      this.hero.cancelAttackPreparation()
      this.hero.idle()
      this.controls.setEnabled(false)
      return
    }
    this.syncContext()
    if (!onStairs) this.hero.update(delta, this.buildings.movementBounds(this.width), actions, platforms)
    if (this.boundaryTravel.update(this.hero.sprite.x, this.buildings.movementBounds(this.width),
      !this.buildings.isInside && this.hero.canInteract)) {
      this.hero.idle()
      this.controls.setEnabled(false)
    }
    if (!onStairs && this.hero.canInteract) this.savePosition()
  }

  private savePosition(): void {
    this.services.options.updatePosition({ locationId: this.location.id, x: this.hero.sprite.x, y: this.hero.sprite.y,
      buildingId: this.buildings.activeId, roomId: this.buildings.activeRoomId, floor: this.buildings.activeFloor })
  }

  private transitionBuilding = (name: string, entering: boolean, change: () => void): void => {
    const loading = this.services.loading
    if (!loading.begin(entering ? name : this.location.name)) return
    this.scene.time.delayedCall(loading.fadeMs, () => {
      loading.covered()
      change()
      this.syncContext()
      this.savePosition()
      loading.ready()
      this.scene.time.delayedCall(loading.fadeMs, loading.finish)
    })
  }

  private damageHero = (amount: number): void => {
    const before = this.services.status.getSnapshot().health
    this.services.status.takeDamage(amount)
    this.services.statistics.record('damageTaken', before - this.services.status.getSnapshot().health)
    if (this.services.status.getSnapshot().health <= 0) this.hero.die()
    else this.hero.showDamage()
  }
  private damageFear = (amount: number, aura = false): void => {
    const resistance = resolveFearResistance(this.services.inventory.getBonusItems(), ITEM_BY_ID, this.services.character?.skills ?? {}, buffFearResistance(this.services.perks.getSnapshot(), this.services.perks.buffDefinitions, itemBuffMultiplier(this.services.character?.skills ?? {})))
    const sanityBefore = this.services.status.getSnapshot().sanity
    this.services.status.drain({ sanity: fearDamage(amount, resistance) })
    if (aura && this.services.status.getSnapshot().sanity < sanityBefore
      && this.services.status.getSnapshot().health > 0 && !isGameplayBlocked(this.services)
      && this.services.loading.getSnapshot().phase === 'idle') {
      this.scene.cameras.main.shake(180, 0.002)
    }
    if (this.services.status.getSnapshot().health <= 0) this.hero.die()
  }

  private attack(kind: 'melee' | 'shot', multiplier = 1, itemId?: string, charge = 0.5): boolean {
    if (isGameplayBlocked(this.services) || this.services.status.getSnapshot().health <= 0) return false
    const weaponMultiplier = this.services.inventory.getWeaponDamageMultiplier(kind, itemId)
    if (kind === 'shot' && !this.services.inventory.tryShoot(itemId)) return false
    const damage = this.patrols.attack(this.hero, kind, this.services.skillEffects, multiplier * weaponMultiplier, this.services.character?.skills, charge)
    this.services.statistics.record(kind === 'shot' ? 'shots' : 'meleeAttacks')
    this.services.statistics.record('damageDealt', damage)
    const action = chargePerkAction(charge, damage)
    if (action) this.services.perks.recordAction(action)
    this.hero.showAttackDamage(damage)
    return true
  }

  private syncContext(): void {
    if (this.buildings.activeId && this.buildings.activeRoomId) {
      this.services.quests.visitRoom(this.location.id, this.buildings.activeId, this.buildings.activeRoomId)
    }
    this.busStop.sprite.setVisible(!this.buildings.isInside)
    // Keep outdoor lighting behind the occupied interior instead of darkening the street.
    this.daytimeTint.setDepth(this.buildings.isInside ? WORLD_LAYERS.interiorShade : WORLD_LAYERS.daytimeTint)
    for (const npc of this.npcs) npc.setContext(this.buildings.activeId, this.buildings.activeRoomId)
    this.patrols.setContext(this.buildings.activeId, this.buildings.activeFloor, this.buildings.activeRoomId)
    this.corpses.setContext(this.buildings.activeId, this.buildings.activeFloor, this.buildings.activeRoomId)
    this.containers.setInside(this.buildings.activeId, true, this.buildings.activeRoomId)
    this.taskboards.setInside(this.buildings.activeId, !this.buildings.isInRoom)
    this.furniture.setContext(this.buildings.activeId, this.buildings.activeRoomId)
  }

  private syncTime(): void {
    const { phase, day } = this.services.daytime.getSnapshot()
    if (phase === this.phase && day === this.day) return
    this.phase = phase
    this.day = day
    setObjectLightPhase(this.scene, phase)
    const filter = DAYTIME_CONFIG.phases[phase].filter
    this.daytimeTint.setFillStyle(filter.color, filter.alpha)
    for (const npc of this.npcs) npc.destroy()
    this.npcs = createLocationNpcs(this.scene, this.location, this.groundY, this.services.dialogue, phase, this.services.quests)
    for (const npc of this.npcs) npc.setContext(this.buildings.activeId, this.buildings.activeRoomId)
    this.patrols.destroy()
    this.corpses.destroy()
    this.patrols = new PatrolManager(this.scene, this.location.id, phase, this.groundY, this.width, this.damageHero,
      this.services.difficulty, this.buildings.patrolSpaces, this.damageFear, Math.random, this.corpses.add, this.services.perks.recordAction,
      { buildingId: this.buildings.activeId, roomId: this.buildings.activeRoomId },
      () => this.services.statistics.record('monstersKilled'))
    this.patrols.setContext(this.buildings.activeId, this.buildings.activeFloor, this.buildings.activeRoomId)
  }
}
