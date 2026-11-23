import type {
  CombatPosition, CorpseDrop, HeroTarget, PatrolAttack,
  PatrolCombatSettings, PatrolTarget,
} from './types'

/**
 * Perform roll corpse loot.
 * @param {readonly CorpseDrop[]} drops - The drops supplied to this operation.
 * @param {() => number} random - Random-number source; injectable for deterministic results.
 * @returns {{ itemId: string; quantity: number; }[]} The result described by the TypeScript return signature.
 */
export function rollCorpseLoot(
  drops: readonly CorpseDrop[],
  random: () => number = Math.random
): {
  itemId: string
  quantity: number
}[] {
  return drops.map(drop => ({
    itemId: drop.itemId,
    quantity: drop.chance !== undefined && random() >= drop.chance ? 0
      : drop.min + Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, random())) * (drop.max - drop.min + 1))
  }))
    .filter(stack => stack.quantity > 0)
}

/**
 * Perform patrol attack kind.
 * @param {Pick<PatrolCombatSettings, "ranged" | "meleeRange" | "levelTolerance">} settings - Configuration values for this instance.
 * @param {number} distance - The distance supplied to this operation.
 * @param {boolean} provoked - The provoked supplied to this operation.
 * @param {number} heightDifference - The height difference supplied to this operation.
 * @returns {PatrolAttack | undefined} The result described by the TypeScript return signature.
 */
export function patrolAttackKind(
  settings: Pick<PatrolCombatSettings, 'meleeRange' | 'levelTolerance' | 'ranged'>,
  distance: number,
  provoked: boolean,
  heightDifference = 0
): PatrolAttack | undefined {
  const range = Math.abs(distance)
  const height = Math.abs(heightDifference)
  if (settings.ranged && (provoked || settings.ranged.requiresProvocation === false)
    && range <= settings.ranged.range && height <= settings.ranged.heightTolerance) return 'shot'

  return range <= settings.meleeRange && height <= settings.levelTolerance ? 'melee' : undefined
}

/**
 * Daytime patrols detect the hero only while a fight is active; hidden targets stay undetectable.
 * @param {{ x: number; y: number; }} patrol - The patrol supplied to this operation.
 * @param {HeroTarget} target - Target considered by this operation.
 * @param {number} radius - The radius supplied to this operation.
 * @param {boolean} night - The night supplied to this operation.
 * @param {boolean} inCombat - The in combat supplied to this operation.
 * @param {boolean} monster - The monster supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function detectsHero(
  patrol: {
    x: number
    y: number
  },
  target: HeroTarget,
  radius: number,
  night: boolean,
  inCombat = false,
  monster = false
): boolean {
  return (monster || night && !target.patrolPass || inCombat) && target.available && Math.hypot(patrol.x - target.x, patrol.y - target.y) <= radius
}

/**
 * Perform closest patrol.
 * @param {CombatPosition} origin - The origin supplied to this operation.
 * @param {readonly T[]} targets - The targets supplied to this operation.
 * @param {"melee" | "shot"} attack - The attack supplied to this operation.
 * @param {number} meleeRange - The melee range supplied to this operation.
 * @param {number} levelTolerance - The level tolerance supplied to this operation.
 * @returns {T | undefined} The result described by the TypeScript return signature.
 */
export function closestPatrol<T extends PatrolTarget>(
  origin: CombatPosition,
  targets: readonly T[],
  attack: 'melee' | 'shot',
  meleeRange: number,
  levelTolerance: number
): T | undefined {
  let selected: T | undefined
  let nearest = Infinity

  for (const target of targets) {
    if (!target.visible || target.health <= 0 || Math.abs(target.y - origin.y) > levelTolerance) continue

    const distance = (target.x - origin.x) ** 2 + (target.y - origin.y) ** 2
    if (attack === 'melee') {
      const a = origin.bounds, b = target.bounds
      if (Math.abs(target.x - origin.x) > meleeRange || a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom) continue
    }

    if (distance < nearest) {
      selected = target
      nearest = distance
    }
  }

  return selected
}
