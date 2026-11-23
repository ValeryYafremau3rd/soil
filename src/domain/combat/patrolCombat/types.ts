/**
 * Actor bounds used to test melee overlap and attack reach.
 */
export interface CombatBounds {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Actor world position and hit bounds used by target selection.
 */
export interface CombatPosition {
  x: number
  y: number
  bounds: CombatBounds
}

/**
 * Combat position with health and visibility used to filter eligible targets.
 */
export interface PatrolTarget extends CombatPosition {
  health: number
  visible: boolean
}

/**
 * Authored patrol combat timing, reach, damage, health and detection settings.
 */
export interface PatrolCombatSettings {
  fear?: FearSettings
  detectionRadius: number
  hitFlashMs: number
  chaseStopRatio: number
  health: number
  meleeDamage: number
  meleeRange: number
  ranged?: {
    damage: number
    range: number
    heightTolerance: number
    requiresProvocation?: boolean
  }
  attackCooldownMs: number
  reactionDelayMs: number
  deathHoldMs: number
  chaseSpeed: number
  levelTolerance: number
}

/**
 * Monster fear radius, ongoing sanity drain and initial detection shock.
 */
export interface FearSettings {
  radius: number
  sanityPerSecond: number
  noticeSanityDamage: number
}

/**
 * Hero position and availability flags supplied to patrol detection rules.
 */
export interface HeroTarget {
  x: number
  y: number
  available: boolean
  patrolPass?: boolean
  hidden?: boolean
}

export type PatrolAttack = 'melee' | 'shot'

/**
 * Independent corpse drop with quantity bounds and optional drop probability.
 */
export interface CorpseDrop {
  itemId: string
  min: number
  max: number
  chance?: number
}
