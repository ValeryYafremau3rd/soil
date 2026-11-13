export type LockNumbers = readonly [number, number, number]
import type { ItemRarity } from '../inventory/items'
export interface LockpickingConfig { lockpickingBaseSeconds: number; lockpickingSecondsPerPoint: number; lockpickingMaxSumByRarity?: Readonly<Record<ItemRarity, number>> }

export function lockMaximum(rarity: ItemRarity, config: LockpickingConfig): number {
  return config.lockpickingMaxSumByRarity?.[rarity] ?? 26
}
export function rollLockTarget(rarity: ItemRarity, config: LockpickingConfig, random: () => number): number {
  return 4 + Math.floor(random() * (lockMaximum(rarity, config) - 3))
}

export function lockDuration(skill: number, config: LockpickingConfig): number {
  return (config.lockpickingBaseSeconds + Math.max(0, skill) * config.lockpickingSecondsPerPoint) * 1000
}

export function matchesLock(numbers: LockNumbers, target: number): boolean {
  return numbers.every(value => Number.isInteger(value) && value >= 1 && value <= 9)
    && numbers.reduce((sum, value) => sum + value, 0) === target
}

export function doorLocked(night: boolean, roomId?: string): boolean {
  return roomId !== undefined || night
}
