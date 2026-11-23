export type LockNumbers = readonly [number, number, number]
import type { ItemRarity } from '../inventory/items'
/**
 * Authored lock puzzle dimensions, difficulty and interaction settings.
 */
export interface LockpickingConfig {
  lockpickingBaseSeconds: number
  lockpickingSecondsPerPoint: number
  lockpickingMaxSumByRarity?: Readonly<Record<ItemRarity, number>>
  doorLocks?: Readonly<Record<string, {
    locked?: boolean
    keyOnly?: boolean
    rarity?: ItemRarity
  }>>
}

/**
 * Perform lock maximum.
 * @param {"common" | "uncommon" | "rare" | "epic" | "legendary"} rarity - The rarity supplied to this operation.
 * @param {LockpickingConfig} config - Configuration consumed by this operation.
 * @returns {number} The calculated numeric result.
 */
export function lockMaximum(rarity: ItemRarity, config: LockpickingConfig): number {
  return config.lockpickingMaxSumByRarity?.[rarity] ?? 26
}

/**
 * Perform roll lock target.
 * @param {"common" | "uncommon" | "rare" | "epic" | "legendary"} rarity - The rarity supplied to this operation.
 * @param {LockpickingConfig} config - Configuration consumed by this operation.
 * @param {() => number} random - Random-number source; injectable for deterministic results.
 * @returns {number} The calculated numeric result.
 */
export function rollLockTarget(
  rarity: ItemRarity,
  config: LockpickingConfig,
  random: () => number
): number {
  return 4 + Math.floor(random() * (lockMaximum(rarity, config) - 3))
}

/**
 * Perform lock duration.
 * @param {number} skill - The skill supplied to this operation.
 * @param {LockpickingConfig} config - Configuration consumed by this operation.
 * @returns {number} The calculated numeric result.
 */
export function lockDuration(
  skill: number,
  config: LockpickingConfig
): number {
  return (config.lockpickingBaseSeconds + Math.max(0, skill) * config.lockpickingSecondsPerPoint) * 1000
}

/**
 * Perform matches lock.
 * @param {LockNumbers} numbers - The numbers supplied to this operation.
 * @param {number} target - Target considered by this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function matchesLock(numbers: LockNumbers, target: number): boolean {
  return numbers.every(value => Number.isInteger(value) && value >= 1 && value <= 9)
    && numbers.reduce((sum, value) => sum + value, 0) === target
}

/**
 * Perform door locked.
 * @param {boolean} night - The night supplied to this operation.
 * @param {string | undefined} roomId - The room id supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function doorLocked(night: boolean, roomId?: string): boolean {
  return roomId !== undefined || night
}
