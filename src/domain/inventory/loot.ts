export interface ItemStack { itemId: string; quantity: number }
export const INVENTORY_CAPACITY = 6
import type { InventoryItemDefinition, ItemRarity, Equipment } from './items'

/** Only the equipped bag expands the six base inventory slots. */
export function inventoryCapacity(equipment: Equipment, definitions: Readonly<Record<string, InventoryItemDefinition>>): number {
  return INVENTORY_CAPACITY + (equipment.bag ? definitions[equipment.bag]?.inventorySlots ?? 0 : 0)
}
export interface LootTable { itemIds: readonly string[]; minItems: number; maxItems: number; minQuantity?: number; maxQuantity?: number; weights?: Readonly<Record<string, number>> }
export interface VendorStock { categories: readonly string[]; minItems: number; maxItems: number; minQuantity: number; maxQuantity: number }
export interface ContainerSeed {
  restock?: boolean
  questId?: string
  questIds?: readonly string[]
  requiresQuest?: string
  nightOnly?: boolean
  lockRarity?: ItemRarity
  quality?: number
  space?: 'inside' | 'outside'
  locked?: boolean
  vendor?: boolean
  id: string; name: string; locationId: string
  items?: readonly ItemStack[]
  refreshLoot?: LootTable
  loot?: LootTable
}
export interface ContainerContents extends ContainerSeed { readonly items: readonly ItemStack[]; lootOnly?: boolean }

export function rollLoot(table: LootTable, random: () => number): ItemStack[] {
  const pool = [...new Set(table.itemIds)]
  if (!pool.length) return []
  const max = Math.min(table.maxItems, pool.length)
  const min = Math.min(table.minItems, max)
  const count = min + Math.floor(random() * (max - min + 1))
  return Array.from({ length: count }, () => {
    let index: number
    if (table.weights) {
      const weights = pool.map(id => table.weights![id] ?? 1)
      if (weights.some(weight => !Number.isFinite(weight) || weight <= 0)) throw new Error('Loot weights must be positive finite numbers')
      let roll = random() * weights.reduce((sum, weight) => sum + weight, 0)
      index = weights.length - 1
      for (let candidate = 0; candidate < weights.length; candidate++) {
        roll -= weights[candidate]
        if (roll < 0) { index = candidate; break }
      }
    } else index = Math.floor(random() * pool.length)
    const quantity = table.minQuantity === undefined ? 1
      : table.minQuantity + Math.floor(random() * ((table.maxQuantity ?? table.minQuantity) - table.minQuantity + 1))
    return { itemId: pool.splice(index, 1)[0], quantity }
  })
}

export type StackLimit = (itemId: string) => number
const singleItem: StackLimit = () => 1

/** Vendors stock at most one stack per item type; ordinary contents remain exact. */
export function seedContainer(seed: ContainerSeed, random: () => number, limit: StackLimit = singleItem): ItemStack[] {
  const items = normalizeStacks([...(seed.items ?? []), ...(seed.loot ? rollLoot(seed.loot, random) : [])], limit)
  return seed.vendor ? items.filter((item, index) => items.findIndex(other => other.itemId === item.itemId) === index) : items
}

export function normalizeStacks(stacks: readonly ItemStack[], limit: StackLimit = singleItem): ItemStack[] {
  let items: readonly ItemStack[] = []
  for (const stack of stacks) items = transferItem(items, [stack], stack.itemId, Infinity, limit).inventory
  return [...items]
}

/** Move one source slot, filling partial stacks first; overflow remains in that slot. */
export function transferItem(inventory: readonly ItemStack[], source: readonly ItemStack[], itemId: string,
  capacity = Infinity, limit: StackLimit = singleItem, sourceSlot = source.findIndex(stack => stack.itemId === itemId), maxQuantity = Infinity) {
  const item = source[sourceSlot]
  if (!item || item.itemId !== itemId || item.quantity <= 0) return { inventory, remaining: source }
  const maxStack = limit(itemId)
  if (!Number.isInteger(maxStack) || maxStack < 1) throw new Error('Stack limits must be positive integers')
  const requested = Math.min(item.quantity, maxQuantity)
  let quantity = requested
  const next = inventory.map(stack => {
    if (stack.itemId !== itemId || stack.quantity >= maxStack) return stack
    const moved = Math.min(maxStack - stack.quantity, quantity)
    quantity -= moved
    return moved ? { ...stack, quantity: stack.quantity + moved } : stack
  })
  while (quantity > 0 && next.length < capacity) {
    const moved = Math.min(maxStack, quantity)
    next.push({ itemId, quantity: moved })
    quantity -= moved
  }
  if (quantity === requested) return { inventory, remaining: source }
  const leftover = item.quantity - requested + quantity
  const remaining = leftover
    ? source.map((stack, index) => index === sourceSlot ? { ...stack, quantity: leftover } : stack)
    : source.filter((_, index) => index !== sourceSlot)
  return { inventory: next, remaining }
}

/** Exchange one stack from each side atomically, using the same capacity and stack limits. */
export function swapItems(inventory: readonly ItemStack[], container: readonly ItemStack[], inventoryItemId: string,
  containerItemId: string, limit: StackLimit = singleItem, capacity = INVENTORY_CAPACITY) {
  const outgoingIndex = inventory.findIndex(item => item.itemId === inventoryItemId)
  const incomingIndex = container.findIndex(item => item.itemId === containerItemId)
  if (outgoingIndex < 0 || incomingIndex < 0 || inventoryItemId === containerItemId) return { inventory, container }
  const outgoing = inventory[outgoingIndex], incoming = container[incomingIndex]
  const taken = transferItem(inventory.filter((_, index) => index !== outgoingIndex), [incoming], incoming.itemId, capacity, limit)
  if (taken.remaining.length) return { inventory, container }
  const stored = transferItem(container.filter((_, index) => index !== incomingIndex), [outgoing], outgoing.itemId, Infinity, limit)
  return { inventory: taken.inventory, container: stored.inventory }
}
