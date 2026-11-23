import type { ItemStack } from './loot'

/**
 * Perform quantity of.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {string} id - The id supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function quantityOf(items: readonly ItemStack[], id: string): number {
  return items.reduce((sum, item) => sum + (item.itemId === id ? item.quantity : 0), 0)
}

/**
 * Spend one indexed unit without merging or reordering neighboring stacks.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {number} slot - The slot supplied to this operation.
 * @returns {ItemStack[]} The result described by the TypeScript return signature.
 */
export function removeStackUnit(items: readonly ItemStack[], slot: number): ItemStack[] {
  return items.flatMap((stack, index) => index !== slot ? [stack]
    : stack.quantity > 1 ? [{ ...stack, quantity: stack.quantity - 1 }] : [])
}

/**
 * Validate all requirements before removing anything; repeated IDs share a total.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {readonly ItemStack[]} requested - The requested supplied to this operation.
 * @returns {readonly ItemStack[] | undefined} The result described by the TypeScript return signature.
 */
export function withoutItems(
  items: readonly ItemStack[],
  requested: readonly ItemStack[]
): readonly ItemStack[] | undefined {
  const needed = new Map<string, number>()

  for (const item of requested) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return undefined

    needed.set(item.itemId, (needed.get(item.itemId) ?? 0) + item.quantity)
  }

  if ([...needed].some(([id, quantity]) => !Number.isSafeInteger(quantity) || quantityOf(items, id) < quantity)) return undefined

  if (!needed.size) return items

  return items.flatMap(stack => {
    const amount = Math.min(stack.quantity, needed.get(stack.itemId) ?? 0)
    needed.set(stack.itemId, (needed.get(stack.itemId) ?? 0) - amount)

    return amount === stack.quantity ? [] : [{ ...stack, quantity: stack.quantity - amount }]
  })
}
