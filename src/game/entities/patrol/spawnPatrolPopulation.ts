import type Phaser from 'phaser'
import { resolveNpcPlacements } from '../../../app/content/resolveNpcPlacements'
import { resolveOutdoorPatrols } from '../../../app/content/resolveOutdoorPatrols'
import type { PatrolSpace } from '../../../app/content/resolvePatrolPopulation'
import { resolveEmptyInteriorSpawns, resolvePatrolEncounter } from '../../../app/content/resolvePatrolPopulation'
import type { DayPhase } from '../../../app/contracts/daytime'
import { HERO_SETTINGS } from '../../../content/hero'
import { LOCATIONS } from '../../../content/locations'
import { NPCS } from '../../../content/npcs'
import { PATROLS } from '../../../content/patrols'
import type { PatrolDefinition } from '../../../content/types'
import { GAME_SETTINGS } from '../../../content/world'
import type { DifficultyRules } from '../../../domain/character/difficulty'
import { patrolDifficulty, patrolMovementDifficulty } from '../../../domain/character/difficulty'
import type { FearSettings } from '../../../domain/combat/patrolCombat'
import { interiorNpcScale } from '../../rendering/interiorNpcScale'
import { Patrol } from '../Patrol'

/** Interior ownership attached to each spawned patrol. */
export interface PatrolContext {
  buildingId?: string
  floor?: number
  roomId?: string
}

/** Scene geometry, population inputs and registration callbacks needed for spawning. */
interface PopulationSetup {
  scene: Phaser.Scene
  locationId: string
  phase: DayPhase
  groundY: number
  width: number
  difficulty: DifficultyRules
  spaces: readonly PatrolSpace[]
  random: () => number
  heroContext: { buildingId?: string; roomId?: string }
  day: number
  onCorpse?: (source: Phaser.GameObjects.Sprite, definition: PatrolDefinition,
    context: PatrolContext) => void
  register(patrol: Patrol, definition: PatrolDefinition, context: PatrolContext,
    fear?: FearSettings): void
}

/**
 * Spawn authored outdoor and empty-interior patrol populations in deterministic order.
 * @param {PopulationSetup} setup - Scene, bounds, difficulty and ownership registration.
 * @returns {Patrol[]} Scene-owned patrol actors; runtime encounter state stays in the manager.
 */
export function spawnPatrolPopulation({
  scene, locationId, phase, groundY, width, difficulty, spaces,
  random, heroContext, day, onCorpse, register,
}: PopulationSetup): Patrol[] {
  const patrols: Patrol[] = []

  /**
   * Perform spawn.
   * @param {string} id - The id supplied to this operation.
   * @param {PatrolDefinition} definition - The definition supplied to this operation.
   * @param {number} count - The count supplied to this operation.
   * @param {{ left: number; right: number; }} bounds - The bounds supplied to this operation.
   * @param {number} y - Vertical coordinate.
   * @param {number} scale - The scale supplied to this operation.
   * @param {{ buildingId?: string | undefined; floor?: number | undefined; roomId?: string | undefined; }} context - The context supplied to this operation.
   * @param {{ left: number; right: number; }} chaseBounds - The chase bounds supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const spawn = (
    id: string,
    definition: PatrolDefinition,
    count: number,
    bounds: {
      left: number
      right: number
    },
    y: number,
    scale: number,
    context: {
      buildingId?: string
      floor?: number
      roomId?: string
    },
    chaseBounds = bounds
  ) => {
    const combat = patrolDifficulty(definition.combat, difficulty, definition.kind)
    const movement = patrolMovementDifficulty(definition.movement, difficulty, definition.kind)

    for (let index = 0;index < count;index++) {
      const patrol = new Patrol(
        scene,
        `${id}-${index + 1}`,
        { ...definition, combat, movement, scale },
        bounds.left + (bounds.right - bounds.left) * random(),
        y,
        bounds,
        definition.kind === 'monster' ? chaseBounds : bounds,
        definition.corpseLoot && onCorpse ? () => onCorpse(patrol.sprite, definition, context) : undefined
      )
      register(patrol, definition, context, combat.fear)
      patrols.push(patrol)
    }
  }
  const population = resolvePatrolEncounter(PATROLS, locationId, phase, random)

  for (const { definition, location, count } of [
    ...(population ? [population] : []),
    ...resolveOutdoorPatrols(PATROLS, locationId, phase, day)
  ]) {
    const bounds = {
      left: Math.max(HERO_SETTINGS.edgeMargin, width * location.bounds.left),
      right: Math.min(width - HERO_SETTINGS.edgeMargin, width * location.bounds.right)
    }
    spawn(
      `${locationId}-${definition.textureKey}`,
      definition,
      count,
      bounds,
      groundY,
      (definition.scale ?? 1) * (location.scale ?? 1),
      {},
      { left: HERO_SETTINGS.edgeMargin, right: width - HERO_SETTINGS.edgeMargin }
    )
  }

  const occupants = resolveNpcPlacements(NPCS, LOCATIONS, locationId, phase)

  for (const { definition, space } of resolveEmptyInteriorSpawns(
    PATROLS,
    locationId,
    phase,
    spaces,
    occupants,
    random,
    heroContext
  )) {
    const scale = definition.kind === 'human'
      ? interiorNpcScale(
        definition,
        HERO_SETTINGS,
        space.clearance,
        GAME_SETTINGS.interaction.interiorHeadroom
      )
      : Math.min(
        0.9,
        (space.clearance - GAME_SETTINGS.interaction.interiorHeadroom) / definition.displayHeight
      )
    spawn(
      `${locationId}-${space.buildingId}-${space.roomId ?? space.floor}`,
      definition,
      1,
      space.bounds,
      space.groundY,
      scale,
      { buildingId: space.buildingId, floor: space.floor, roomId: space.roomId },
      space.bounds
    )
  }

  return patrols
}
