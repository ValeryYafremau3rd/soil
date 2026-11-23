import type Phaser from 'phaser'
import type { GameServices } from '../../../app/contracts/game'
import type { TravelLocation } from '../../../app/contracts/travel'
import { HERO_SETTINGS } from '../../../content/hero'
import { WORLD_LAYERS } from '../../../content/world'
import { perkChargeDamage } from '../../../domain/character/perks'
import { movementEnergyCost } from '../../../domain/movement/energy'
import { Hero } from '../../entities/Hero'
import { LocationCombatController } from './LocationCombatController'

/** Inputs for a scene-owned hero and its inventory appearance subscription. */
interface HeroSetup {
  scene: Phaser.Scene
  location: TravelLocation
  groundY: number
  width: number
  services: Pick<GameServices, 'travel' | 'difficulty' | 'skillEffects' | 'inventory'
    | 'statistics' | 'status' | 'character' | 'perks'>
  combat: Pick<LocationCombatController, 'attack' | 'damageHero'>
}

/**
 * Create the arriving hero and bind clothing updates until scene shutdown.
 * @param {HeroSetup} setup - World geometry and typed movement/combat capabilities.
 * @returns {Hero} Scene-owned hero, positioned safely inside the arrival edge.
 */
export function createWorldHero({ scene, location, groundY, width, services, combat }: HeroSetup): Hero {
  const arrivalEdge = services.travel.getSnapshot().arrivalEdge
  // Keep a full edge margin inside the destination so arrival cannot retrigger travel.
  const edgeSpawn = Math.min(HERO_SETTINGS.edgeMargin * 2, width / 2)
  const arrivalX = arrivalEdge === 'left' ? edgeSpawn : arrivalEdge === 'right' ? width - edgeSpawn
    : location.busStop.x + location.busStop.spawnOffset
  const hero = new Hero(
    scene,
    arrivalX,
    groundY,
    (multiplier, charge) => combat.attack('shot', multiplier, undefined, charge),
    (multiplier, charge) => combat.attack('melee', multiplier, undefined, charge),
    combat.damageHero,
    services.difficulty.hero.fallDamage,
    () => services.skillEffects.movement,
    services.inventory.canShoot,
    (
      distance,
      jumped
    ) => {
      if (jumped) services.statistics.record('jumps')

      services.status.drain({
        energy: movementEnergyCost(
          distance,
          jumped,
          HERO_SETTINGS.energyCosts,
          services.difficulty.modifiers.energyCost,
          services.character?.skills.athletics
        )
      })
    },
    charge => perkChargeDamage(services.perks.getSnapshot(), services.perks.definitions, charge),
    distance => services.statistics.record('distance', distance)
  )

  /**
   * Perform sync clothing.
   * @returns {void} Completes the operation without returning a value.
   */
  const syncClothing = () => hero.setClothing(services.inventory.getSnapshot().equipment.armor)
  syncClothing()
  const unsubscribeClothing = services.inventory.subscribe(syncClothing)
  scene.events.once('shutdown', unsubscribeClothing)
  hero.sprite.setDepth(WORLD_LAYERS.hero)
  return hero
}
