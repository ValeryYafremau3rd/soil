import type { DialogueDefinition } from '../../domain/dialogue/dialogue'
import type { ItemDefinition } from '../../content/types'
import type { ContainerSeed, VendorStock } from '../../domain/inventory/loot'

/**
 * Perform vendor item pool.
 * @param {VendorStock} stock - The stock supplied to this operation.
 * @param {readonly ItemDefinition[]} items - Item stacks to inspect or transform.
 * @param {readonly string[]} staples - The staples supplied to this operation.
 * @returns {string[]} The result described by the TypeScript return signature.
 */
export function vendorItemPool(
  stock: VendorStock,
  items: readonly ItemDefinition[],
  staples: readonly string[] = []
): string[] {
  return items.filter(item => item.id !== 'pistol-ammunition' && (item.maxStack ?? 1) > 1 && stock.categories.includes(item.category) && item.randomLoot !== false && !staples.includes(item.id)).map(item => item.id)
}

/**
 * Roll authored offers and category supplies once per morning, never per visit.
 * @param {Readonly<Record<string, DialogueDefinition>>} dialogues - The dialogues supplied to this operation.
 * @param {readonly ItemDefinition[]} items - Item stacks to inspect or transform.
 * @returns {ContainerSeed[]} The result described by the TypeScript return signature.
 */
export function buildVendorSeeds(
  dialogues: Readonly<Record<string, DialogueDefinition>>,
  items: readonly ItemDefinition[]
): ContainerSeed[] {
  return Object.values(dialogues).flatMap(dialogue => {
    return [...(dialogue.barter ? [dialogue.barter] : []), ...dialogue.barters ?? []].map(barter => {
      const { stock, ...seed } = barter

      return {
        ...seed,
        vendor: true,
        ...(stock ? {
          loot: {
            offers: stock.offers,
            itemIds: stock.offers ? [] : vendorItemPool(stock, items, (seed.items ?? []).map(item => item.itemId)),
            minItems: stock.minItems,
            maxItems: stock.maxItems,
            minQuantity: stock.minQuantity,
            maxQuantity: stock.maxQuantity,
          }
        } : {})
      }
    })
  })
}
