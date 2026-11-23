import type { ItemStack } from './loot'

/** Reports the carried slot cost of one item stack. */
export type SlotCost = (itemId: string) => number

/**
 * Count carried slots, allowing perk-exempt currency to cost zero.
 * @param {readonly ItemStack[]} items - Carried stacks to measure.
 * @param {SlotCost} cost - Slot cost per stack; defaults to one.
 * @returns {number} Total occupied slots.
 */
export function occupiedSlots(
  items: readonly ItemStack[],
  cost: SlotCost = () => 1
): number {
  return items.reduce((total, item) => total + cost(item.itemId), 0)
}
