import type { Recovery, Vital } from '../inventory/items'
import type { PatrolCombatSettings } from '../combat/patrolCombat'
import type { FallDamageSettings } from '../movement/fallDamage'
import type { WanderSettings } from '../npcs/Wanderer'

export const DIFFICULTY_MODIFIERS = [
  'heroDamage',
  'patrolDamage',
  'patrolHealth',
  'fallDamage',
  'safeFallHeight',
  'restRecovery',
  'sleepRecovery',
  'itemRecovery',
  'energyCost',
  'sanityCost',
  'startingHealth',
  'startingEnergy',
  'startingSanity',
  'maximumStats',
  'patrolCooldown',
  'patrolReaction',
  'patrolSpeed',
  'patrolDetection',
  'monsterStrength'
] as const
/**
 * Named difficulty choice with gameplay scaling modifiers.
 */
export interface DifficultyPreset {
  id: string
  name: string
  description: string
  modifiers: Record<typeof DIFFICULTY_MODIFIERS[number], number>
}
/**
 * Available difficulty presets and the default selection identifier.
 */
export interface DifficultyConfiguration {
  defaultId: string
  presets: readonly DifficultyPreset[]
}
/**
 * Base hero attack values and fall-damage configuration before difficulty scaling.
 */
export interface HeroCombatSettings {
  meleeDamage: number
  shotDamage: number
  meleeRange: number
  combatLevelTolerance: number
  fallDamage: FallDamageSettings
}
/**
 * Base hero, vital, recovery and time-cost values used to resolve difficulty.
 */
export interface BalanceBase {
  hero: HeroCombatSettings
  stats: readonly {
    id: Vital
    value: number
    max: number
  }[]
  rest: {
    healthRecovery: {
      rest: number
      sleep: number
    }
    energyRecovery: {
      rest: number
      sleep: number
    }
    sanityRecovery: {
      rest: number
      sleep: number
    }
  }
  timeCosts: {
    energy: number
    sanity: number
  }
}

/**
 * Perform scale recovery.
 * @param {Partial<Record<Vital, number>>} recovery - The recovery supplied to this operation.
 * @param {number} multiplier - Scaling factor applied to the base value.
 * @returns {Partial<Record<Vital, number>>} The result described by the TypeScript return signature.
 */
export function scaleRecovery(
  recovery: Recovery,
  multiplier: number
): Recovery {
  return Object.fromEntries(Object.entries(recovery).map(([key, amount]) => [key, Math.max(0, Math.round(amount * multiplier))]))
}

/**
 * Resolve difficulty from the supplied state.
 * @param {DifficultyConfiguration} config - Configuration consumed by this operation.
 * @param {string} id - The id supplied to this operation.
 * @param {BalanceBase} base - The base supplied to this operation.
 * @returns {object} The result described by the TypeScript return signature.
 */
export function resolveDifficulty(
  config: DifficultyConfiguration,
  id: string,
  base: BalanceBase
) {
  const preset = config.presets.find(entry => entry.id === id)
  if (!preset) throw new Error(`Unknown difficulty: ${id}`)

  const m = preset.modifiers

  /**
   * Perform rest.
   * @param {"rest" | "sleep"} kind - The kind supplied to this operation.
   * @returns {Partial<Record<Vital, number>>} The result described by the TypeScript return signature.
   */
  const rest = (kind: 'rest' | 'sleep') => scaleRecovery(
    {
      health: base.rest.healthRecovery[kind],
      energy: base.rest.energyRecovery[kind],
      sanity: base.rest.sanityRecovery[kind],
    },
    kind === 'rest' ? m.restRecovery : m.sleepRecovery
  )

  return {
    ...preset,
    hero: {
      ...base.hero,
      meleeDamage: Math.round(base.hero.meleeDamage * m.heroDamage),
      shotDamage: Math.round(base.hero.shotDamage * m.heroDamage),
      fallDamage: {
        safeHeight: base.hero.fallDamage.safeHeight * m.safeFallHeight,
        damagePerPixel: base.hero.fallDamage.damagePerPixel * m.fallDamage
      }
    },
    stats: base.stats.map(stat => {
      const max = Math.max(1, Math.round(stat.max * m.maximumStats))

      return {
        ...stat,
        max,
        value: Math.min(
          max,
          Math.round(stat.value * ({ health: m.startingHealth, energy: m.startingEnergy, sanity: m.startingSanity }[stat.id]))
        )
      }
    }),
    recovery: { rest: rest('rest'), sleep: rest('sleep') },
    timeCosts: {
      energy: base.timeCosts.energy * m.energyCost,
      sanity: base.timeCosts.sanity * m.sanityCost
    },
  }
}
export type DifficultyRules = ReturnType<typeof resolveDifficulty>

/**
 * Perform patrol movement difficulty.
 * @param {WanderSettings} base - The base supplied to this operation.
 * @param {object} rules - The rules supplied to this operation.
 * @param {string} kind - The kind supplied to this operation.
 * @returns {WanderSettings} The result described by the TypeScript return signature.
 */
export function patrolMovementDifficulty(
  base: WanderSettings,
  rules: DifficultyRules,
  kind = 'human'
): WanderSettings {
  return {
    ...base,
    speed: base.speed * (kind === 'monster' ? rules.modifiers.monsterStrength : rules.modifiers.patrolSpeed)
  }
}

/**
 * Perform patrol difficulty.
 * @param {PatrolCombatSettings} base - The base supplied to this operation.
 * @param {object} rules - The rules supplied to this operation.
 * @param {string} kind - The kind supplied to this operation.
 * @returns {PatrolCombatSettings} The result described by the TypeScript return signature.
 */
export function patrolDifficulty(
  base: PatrolCombatSettings,
  rules: DifficultyRules,
  kind = 'human'
): PatrolCombatSettings {
  const m = rules.modifiers
  if (kind === 'monster') {
    const scale = m.monsterStrength

    return {
      ...base,
      health: Math.max(1, Math.round(base.health * scale)),
      meleeDamage: Math.round(base.meleeDamage * scale),
      chaseSpeed: base.chaseSpeed * scale,
      detectionRadius: base.detectionRadius * scale,
      meleeRange: base.meleeRange * scale,
      attackCooldownMs: base.attackCooldownMs / scale,
      reactionDelayMs: base.reactionDelayMs / scale,
      ...(base.ranged ? {
        ranged: {
          ...base.ranged,
          damage: Math.round(base.ranged.damage * scale),
          range: base.ranged.range * scale
        }
      } : {}),
      ...(base.fear ? {
        fear: {
          radius: base.fear.radius * scale,
          sanityPerSecond: base.fear.sanityPerSecond * scale,
          noticeSanityDamage: Math.round(base.fear.noticeSanityDamage * scale)
        }
      } : {})
    }
  }

  return {
    ...base,
    ...(base.ranged ? { ranged: { ...base.ranged, damage: Math.round(base.ranged.damage * m.patrolDamage) } } : {}),
    ...(base.fear ? {
      fear: {
        ...base.fear, sanityPerSecond: base.fear.sanityPerSecond * m.patrolDamage,
        noticeSanityDamage: Math.round(base.fear.noticeSanityDamage * m.patrolDamage)
      }
    } : {}),
    detectionRadius: base.detectionRadius * m.patrolDetection,
    health: Math.max(1, Math.round(base.health * m.patrolHealth)),
    meleeDamage: Math.round(base.meleeDamage * m.patrolDamage),
    attackCooldownMs: base.attackCooldownMs * m.patrolCooldown,
    reactionDelayMs: base.reactionDelayMs * m.patrolReaction,
    chaseSpeed: base.chaseSpeed * m.patrolSpeed
  }
}
