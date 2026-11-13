import type { DialogueDefinition } from '../../domain/dialogue/dialogue'
import type { ItemDefinition } from '../../content/types'
import type { ContainerSeed, VendorStock } from '../../domain/inventory/loot'

export function vendorItemPool(stock: VendorStock, items: readonly ItemDefinition[], staples: readonly string[] = []): string[] {
  return items.filter(item => item.id !== 'pistol-ammunition' && (item.maxStack ?? 1) > 1 && stock.categories.includes(item.category) && item.randomLoot !== false && !staples.includes(item.id)).map(item => item.id)
}

/** Seed fixed goods once and roll stackable category supplies for morning refreshes. */
export function buildVendorSeeds(dialogues: Readonly<Record<string, DialogueDefinition>>, items: readonly ItemDefinition[]): ContainerSeed[] {
  return Object.values(dialogues).flatMap(dialogue => {
    return [...(dialogue.barter ? [dialogue.barter] : []), ...dialogue.barters ?? []].map(barter => {
    const { stock, ...seed } = barter
    return { ...seed, vendor: true, ...(stock ? { loot: {
      itemIds: vendorItemPool(stock, items, (seed.items ?? []).map(item => item.itemId)),
      minItems: stock.minItems, maxItems: stock.maxItems, minQuantity: stock.minQuantity, maxQuantity: stock.maxQuantity,
    } } : {}) }
    })
  })
}
