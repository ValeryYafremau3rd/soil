import type { InventoryItemDefinition } from './items'
import type { ContainerContents, ItemStack } from './loot'

/**
 * Perform attach key items.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {readonly string[]} keyItems - The key items supplied to this operation.
 * @param {Readonly<Record<string, Pick<ContainerContents, "items">>>} containers - The containers supplied to this operation.
 * @param {Readonly<Record<string, InventoryItemDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @returns {{ items: readonly ItemStack[]; keyItems: string[]; }} The result described by the TypeScript return signature.
 */
export function attachKeyItems(
  items: readonly ItemStack[],
  keyItems: readonly string[],
  containers: Readonly<Record<string, Pick<ContainerContents, 'items'>>>,
  definitions: Readonly<Record<string, InventoryItemDefinition>>
) {
  const attached = items.filter(item => definitions[item.itemId]?.attachToKeyRing)
  const remaining = items.filter(item => !definitions[item.itemId]?.attachToKeyRing)
  if (attached.length && ![...remaining, ...Object.values(containers).flatMap(container => container.items)]
    .some(item => item.itemId === 'key-ring')) remaining.push({ itemId: 'key-ring', quantity: 1 })

  return {
    items: attached.length ? remaining : items,
    keyItems: [...new Set([...keyItems, ...attached.map(item => item.itemId)])]
  }
}
