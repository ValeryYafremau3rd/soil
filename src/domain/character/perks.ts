import { scaleItemBuff } from '../skills/effects.ts'
import type { Recovery } from '../inventory/items'
import type { ConsumableBuffDefinition, PerkAction, PerkDefinition, PerksSnapshot } from './perkTypes'

// Preserve the public entry point while definitions live beside their owning rules.
export type { ConsumableBuffDefinition, PerkAction, PerkDefinition, PerksSnapshot } from './perkTypes'
export { PERK_ACTIONS } from './perkTypes.ts'

/**
 * Perform empty perks.
 * @returns {PerksSnapshot} The result described by the TypeScript return signature.
 */
export const emptyPerks = (): PerksSnapshot => ({ counts: {}, acquired: [], habits: {} })

/**
 * Older saves could contain several item bundles in one category. Keep the latest.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly ConsumableBuffDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @returns {PerksSnapshot} The result described by the TypeScript return signature.
 */
export function normalizeConsumableGroups(
  state: PerksSnapshot,
  definitions: readonly ConsumableBuffDefinition[]
): PerksSnapshot {
  const entries = (state.buffs ?? []).map((
    active,
    index
  ) => ({ active, index, definition: definitions.find(buff => buff.id === active.id) }))
  const sources = new Map<string, readonly string[]>()

  for (const entry of [...entries].sort((
    a,
    b
  ) => b.active.expiresAt - a.active.expiresAt
  || (a.definition?.itemIds.length ?? 0) - (b.definition?.itemIds.length ?? 0) || b.index - a.index)) {
    const definition = entry.definition
    if (definition?.group && !sources.has(definition.group)) sources.set(definition.group, definition.itemIds)
  }

  return {
    ...state,
    ...(state.buffs ? {
      buffs: entries.filter(({ definition }) => !definition?.group
        || definition.itemIds.some(id => sources.get(definition.group!)!.includes(id))).map(entry => entry.active)
    } : {})
  }
}

/**
 * Perform progress for action.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly PerkDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {object} action - The action supplied to this operation.
 * @returns {PerksSnapshot} The result described by the TypeScript return signature.
 */
export function progressForAction(
  state: PerksSnapshot,
  definitions: readonly PerkDefinition[],
  action: PerkAction
): PerksSnapshot {
  let next = state

  for (const perk of definitions) {
    const points = perk.actionPoints?.[action]
    if (!points || definitions.some(other => other.group === perk.group && next.acquired.includes(other.id))) continue

    const count = Math.min(perk.goal, (next.counts[perk.id] ?? 0) + points)
    next = {
      ...next,
      counts: { ...next.counts, [perk.id]: count },
      acquired: count === perk.goal ? [...next.acquired, perk.id] : next.acquired
    }
  }

  return next
}

/**
 * Perform buff fear resistance.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly ConsumableBuffDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {number} multiplier - Scaling factor applied to the base value.
 * @returns {number} The calculated numeric result.
 */
export function buffFearResistance(
  state: PerksSnapshot,
  definitions: readonly ConsumableBuffDefinition[],
  multiplier = 1
): number {
  return definitions.filter(buff => buff.fearResistance && state.buffs?.some(active => active.id === buff.id))
    .reduce(
      (sum, buff) => sum + scaleItemBuff(buff.amount, multiplier),
      0
    )
}

/**
 * Perform buff damage resistance.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly ConsumableBuffDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {number} multiplier - Scaling factor applied to the base value.
 * @returns {number} The calculated numeric result.
 */
export function buffDamageResistance(
  state: PerksSnapshot,
  definitions: readonly ConsumableBuffDefinition[],
  multiplier = 1
): number {
  return definitions.filter(buff => buff.damageResistance && state.buffs?.some(active => active.id === buff.id))
    .reduce(
      (sum, buff) => sum + scaleItemBuff(buff.amount, multiplier),
      0
    )
}

/**
 * Perform perk recovery.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly PerkDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {string} itemId - Identifier of the item being processed.
 * @param {Partial<Record<Vital, number>>} recovery - The recovery supplied to this operation.
 * @returns {Partial<Record<Vital, number>>} The result described by the TypeScript return signature.
 */
export function perkRecovery(
  state: PerksSnapshot,
  definitions: readonly PerkDefinition[],
  itemId: string,
  recovery: Recovery
): Recovery {
  const perk = definitions.find(perk => state.acquired.includes(perk.id) && perk.itemIds.includes(itemId))

  return perk && recovery.sanity ? { ...recovery, sanity: recovery.sanity * perk.sanityMultiplier } : recovery
}

/**
 * Perform consume for perks.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly PerkDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {string} itemId - Identifier of the item being processed.
 * @param {number} sanity - The sanity supplied to this operation.
 * @param {number} tick - The tick supplied to this operation.
 * @returns {PerksSnapshot} The result described by the TypeScript return signature.
 */
export function consumeForPerks(
  state: PerksSnapshot,
  definitions: readonly PerkDefinition[],
  itemId: string,
  sanity: number,
  tick: number
): PerksSnapshot {
  let next = state

  for (const perk of definitions.filter(perk => perk.itemIds.includes(itemId))) {
    const count = Math.min(perk.goal, (next.counts[perk.id] ?? 0) + 1)
    const blocked = definitions.some(other => other.group === perk.group && next.acquired.includes(other.id))
    const acquired = count >= perk.goal && !blocked ? [...next.acquired, perk.id] : next.acquired
    next = {
      ...next, counts: { ...next.counts, [perk.id]: count }, acquired,
      habits: {
        ...next.habits, [perk.id]: {
          lastUse: tick, lastPenalty: tick, sanity,
          ...(acquired.includes(perk.id) ? { willpower: perk.willpowerOnUse } : {})
        }
      }
    }
  }

  return next
}

/**
 * Perform expire perks.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly PerkDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {number} tick - The tick supplied to this operation.
 * @param {number} phasesPerDay - The phases per day supplied to this operation.
 * @returns {PerksSnapshot} The result described by the TypeScript return signature.
 */
export function expirePerks(
  state: PerksSnapshot,
  definitions: readonly PerkDefinition[],
  tick: number,
  phasesPerDay: number
): PerksSnapshot {
  const habits = { ...state.habits }

  for (const perk of definitions.filter(perk => state.acquired.includes(perk.id))) {
    const habit = habits[perk.id]
    if (habit) habits[perk.id] = {
      ...habit,
      willpower: tick - habit.lastUse >= phasesPerDay ? perk.willpowerAfterDay : perk.willpowerOnUse
    }
  }

  return {
    ...state,
    habits,
    ...(state.buffs ? { buffs: state.buffs.filter(buff => buff.expiresAt > tick) } : {})
  }
}

/**
 * Perform consume for buffs.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly ConsumableBuffDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {string} itemId - Identifier of the item being processed.
 * @param {number} tick - The tick supplied to this operation.
 * @param {number} phasesPerDay - The phases per day supplied to this operation.
 * @returns {PerksSnapshot} The result described by the TypeScript return signature.
 */
export function consumeForBuffs(
  state: PerksSnapshot,
  definitions: readonly ConsumableBuffDefinition[],
  itemId: string,
  tick: number,
  phasesPerDay: number
): PerksSnapshot {
  const matching = definitions.filter(buff => buff.itemIds.includes(itemId))
  if (!matching.length) return state

  const buffs = new Map((state.buffs ?? []).map(buff => [buff.id, buff]))

  for (const buff of matching) if (buff.group) {
    for (const other of definitions) if (other.group === buff.group) buffs.delete(other.id)
  }

  for (const buff of matching) buffs.set(buff.id, { id: buff.id, expiresAt: tick + buff.durationDays * phasesPerDay })

  return { ...state, buffs: [...buffs.values()] }
}

/**
 * Four phases are one full elapsed game day, including skipped phases during sleep.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly PerkDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {number} tick - The tick supplied to this operation.
 * @param {number} phasesPerDay - The phases per day supplied to this operation.
 * @returns {{ state: PerksSnapshot; sanity: number; }} The result described by the TypeScript return signature.
 */
export function perkWithdrawal(
  state: PerksSnapshot,
  definitions: readonly PerkDefinition[],
  tick: number,
  phasesPerDay: number
): {
  state: PerksSnapshot
  sanity: number
} {
  let sanity = 0
  const habits = { ...state.habits }

  for (const perk of definitions.filter(perk => state.acquired.includes(perk.id))) {
    const habit = habits[perk.id]
    if (!habit) continue

    const days = Math.floor((tick - habit.lastPenalty) / phasesPerDay)
    if (days <= 0) continue

    sanity += days * habit.sanity * perk.withdrawalFraction
    habits[perk.id] = { ...habit, lastPenalty: habit.lastPenalty + days * phasesPerDay }
  }

  return { state: { ...state, habits }, sanity }
}

/**
 * Interpolate acquired perk damage adjustments between the charge endpoints.
 * @param {PerksSnapshot} state - Current state used by the rule.
 * @param {readonly PerkDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {number} charge - The charge supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function perkChargeDamage(
  state: PerksSnapshot,
  definitions: readonly PerkDefinition[],
  charge: number
): number {
  return definitions.filter(perk => state.acquired.includes(perk.id)).reduce(
    (
      sum,
      perk
    ) =>
      sum + (perk.chargeDamage ? perk.chargeDamage.start * (1 - charge) + perk.chargeDamage.full * charge : 0),
    0
  )
}

/**
 * Perform charge perk action.
 * @param {number} charge - The charge supplied to this operation.
 * @param {number} damage - The damage supplied to this operation.
 * @returns {object} The result described by the TypeScript return signature.
 */
export function chargePerkAction(
  charge: number,
  damage: number
): PerkAction | undefined {
  if (!Number.isFinite(damage) || damage <= 0 || !Number.isFinite(charge) || charge < 0 || charge > 1 || charge === 0.5) return undefined

  return charge > 0.5 ? 'attackAboveHalf' : 'attackBelowHalf'
}

export { perkCharacter, buffVitals } from './perkCharacter.ts'
