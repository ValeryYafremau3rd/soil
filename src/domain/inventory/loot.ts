/**
 * An item identifier and quantity; stack limits come from its item definition.
 */
export interface ItemStack {
  itemId: string
  quantity: number
}
export const INVENTORY_CAPACITY = 6
import type { InventoryItemDefinition, ItemRarity, Equipment } from './items'
import { occupiedSlots } from './slotUsage.ts'
import type { SlotCost } from './slotUsage'

/**
 * Only the equipped bag expands the six base inventory slots.
 * @param {Partial<Record<"melee" | "ranged" | "tool" | "armor" | "shoes" | "accessory" | "amulet" | "bag", string>>} equipment - The equipment supplied to this operation.
 * @param {Readonly<Record<string, InventoryItemDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @returns {number} The calculated numeric result.
 */
export function inventoryCapacity(
  equipment: Equipment,
  definitions: Readonly<Record<string, InventoryItemDefinition>>
): number {
  return INVENTORY_CAPACITY + (equipment.bag ? definitions[equipment.bag]?.inventorySlots ?? 0 : 0)
}
/**
 * Independent daily vendor offer with an item identifier and probability.
 */
export interface VendorOffer {
  itemId: string
  chance: number
}
/**
 * Runtime random loot pool with count limits, weights and optional vendor offers.
 */
export interface LootTable {
  offers?: readonly VendorOffer[]
  itemIds: readonly string[]
  minItems: number
  maxItems: number
  minQuantity?: number
  maxQuantity?: number
  weights?: Readonly<Record<string, number>>
}
/**
 * Authored daily vendor offers, fallback categories and quantity limits.
 */
export interface VendorStock {
  offers?: readonly VendorOffer[]
  categories: readonly string[]
  minItems: number
  maxItems: number
  minQuantity: number
  maxQuantity: number
}
/**
 * Initial container identity, fixed contents and random stock configuration.
 */
export interface ContainerSeed {
  restock?: boolean
  questId?: string
  questIds?: readonly string[]
  requiresQuest?: string
  nightOnly?: boolean
  lockRarity?: ItemRarity
  quality?: number
  space?: 'inside' | 'outside'
  keyOnly?: boolean
  locked?: boolean
  vendor?: boolean
  id: string
  name: string
  locationId: string
  items?: readonly ItemStack[]
  refreshLoot?: LootTable
  loot?: LootTable
}
/**
 * Current persistent container items together with their seed metadata.
 */
export interface ContainerContents extends ContainerSeed {
  readonly items: readonly ItemStack[]
  lootOnly?: boolean
}

/**
 * Perform roll loot.
 * @param {LootTable} table - The table supplied to this operation.
 * @param {() => number} random - Random-number source; injectable for deterministic results.
 * @returns {ItemStack[]} The result described by the TypeScript return signature.
 */
export function rollLoot(
  table: LootTable,
  random: () => number
): ItemStack[] {
  const pool = [...new Set(table.itemIds)]
  if (!pool.length) return []

  const max = Math.min(table.maxItems, pool.length)
  const min = Math.min(table.minItems, max)
  const count = min + Math.floor(random() * (max - min + 1))

  return Array.from(
    { length: count },
    () => {
      let index: number
      if (table.weights) {
        const weights = pool.map(id => table.weights![id] ?? 1)
        if (weights.some(weight => !Number.isFinite(weight) || weight <= 0)) throw new Error('Loot weights must be positive finite numbers')

        let roll = random() * weights.reduce((sum, weight) => sum + weight, 0)
        index = weights.length - 1

        for (let candidate = 0;candidate < weights.length;candidate++) {
          roll -= weights[candidate]
          if (roll < 0) {
            index = candidate
            break
          }
        }
      } else index = Math.floor(random() * pool.length)

      const quantity = table.minQuantity === undefined ? 1
        : table.minQuantity + Math.floor(random() * ((table.maxQuantity ?? table.minQuantity) - table.minQuantity + 1))

      return { itemId: pool.splice(index, 1)[0], quantity }
    }
  )
}

export type StackLimit = (itemId: string) => number

/**
 * Perform single item.
 * @returns {number} The calculated numeric result.
 */
const singleItem: StackLimit = () => 1

/**
 * Vendors stock at most one stack per item type; ordinary contents remain exact.
 * @param {ContainerSeed} seed - The seed supplied to this operation.
 * @param {() => number} random - Random-number source; injectable for deterministic results.
 * @param {StackLimit} limit - The limit supplied to this operation.
 * @returns {ItemStack[]} The result described by the TypeScript return signature.
 */
export function seedContainer(
  seed: ContainerSeed,
  random: () => number,
  limit: StackLimit = singleItem
): ItemStack[] {
  const offers = seed.loot?.offers?.flatMap(offer => random() < offer.chance ? [{ itemId: offer.itemId, quantity: 1 }] : []) ?? []
  const items = normalizeStacks(
    [...(seed.items ?? []), ...(seed.loot ? rollLoot(seed.loot, random) : []), ...offers],
    limit
  )

  return seed.vendor ? items.filter((item, index) => items.findIndex(other => other.itemId === item.itemId) === index) : items
}

/**
 * Perform normalize stacks.
 * @param {readonly ItemStack[]} stacks - The stacks supplied to this operation.
 * @param {StackLimit} limit - The limit supplied to this operation.
 * @returns {ItemStack[]} The result described by the TypeScript return signature.
 */
export function normalizeStacks(
  stacks: readonly ItemStack[],
  limit: StackLimit = singleItem
): ItemStack[] {
  let items: readonly ItemStack[] = []

  for (const stack of stacks) items = transferItem(items, [stack], stack.itemId, Infinity, limit).inventory

  return [...items]
}

/**
 * Move one source slot, filling partial stacks first; overflow remains in that slot.
 * @param {readonly ItemStack[]} inventory - Inventory capability used to read or transact items.
 * @param {readonly ItemStack[]} source - Source data or actor used by this operation.
 * @param {string} itemId - Identifier of the item being processed.
 * @param {number} capacity - The capacity supplied to this operation.
 * @param {StackLimit} limit - The limit supplied to this operation.
 * @param {number} sourceSlot - The source slot supplied to this operation.
 * @param {number} maxQuantity - The max quantity supplied to this operation.
 * @param {SlotCost} slotCost - Optional carried slot cost; containers use one per stack.
 * @returns {{ inventory: readonly ItemStack[]; remaining: readonly ItemStack[]; }} The result described by the TypeScript return signature.
 */
export function transferItem(
  inventory: readonly ItemStack[],
  source: readonly ItemStack[],
  itemId: string,
  capacity = Infinity,
  limit: StackLimit = singleItem,
  sourceSlot = source.findIndex(stack => stack.itemId === itemId),
  maxQuantity = Infinity,
  slotCost: SlotCost = () => 1
) {
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
  let occupied = occupiedSlots(next, slotCost)
  while (quantity > 0 && (slotCost(itemId) === 0 || occupied < capacity)) {
    const moved = Math.min(maxStack, quantity)
    next.push({ itemId, quantity: moved })
    occupied += slotCost(itemId)
    quantity -= moved
  }
  if (quantity === requested) return { inventory, remaining: source }

  const leftover = item.quantity - requested + quantity
  const remaining = leftover
    ? source.map((stack, index) => index === sourceSlot ? { ...stack, quantity: leftover } : stack)
    : source.filter((_, index) => index !== sourceSlot)

  return { inventory: next, remaining }
}

/**
 * Exchange one stack from each side atomically, using the same capacity and stack limits.
 * @param {readonly ItemStack[]} inventory - Inventory capability used to read or transact items.
 * @param {readonly ItemStack[]} container - The container supplied to this operation.
 * @param {string} inventoryItemId - The inventory item id supplied to this operation.
 * @param {string} containerItemId - The container item id supplied to this operation.
 * @param {StackLimit} limit - The limit supplied to this operation.
 * @param {number} capacity - The capacity supplied to this operation.
 * @param {SlotCost} slotCost - Optional carried slot cost for the receiving inventory.
 * @returns {{ inventory: readonly ItemStack[]; container: readonly ItemStack[]; }} The result described by the TypeScript return signature.
 */
export function swapItems(
  inventory: readonly ItemStack[],
  container: readonly ItemStack[],
  inventoryItemId: string,
  containerItemId: string,
  limit: StackLimit = singleItem,
  capacity = INVENTORY_CAPACITY,
  slotCost: SlotCost = () => 1
) {
  const outgoingIndex = inventory.findIndex(item => item.itemId === inventoryItemId)
  const incomingIndex = container.findIndex(item => item.itemId === containerItemId)
  if (outgoingIndex < 0 || incomingIndex < 0 || inventoryItemId === containerItemId) return { inventory, container }

  const outgoing = inventory[outgoingIndex], incoming = container[incomingIndex]
  const taken = transferItem(
    inventory.filter((_, index) => index !== outgoingIndex),
    [incoming],
    incoming.itemId,
    capacity,
    limit,
    undefined,
    Infinity,
    slotCost
  )
  if (taken.remaining.length) return { inventory, container }

  const stored = transferItem(
    container.filter((_, index) => index !== incomingIndex),
    [outgoing],
    outgoing.itemId,
    Infinity,
    limit
  )

  return { inventory: taken.inventory, container: stored.inventory }
}
