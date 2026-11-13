import type { ItemStack } from '../inventory/loot'
import type { InventoryItemDefinition } from '../inventory/items'

/** Select the first carried gun with compatible ammunition and spend exactly one round. */
export function spendShot(items: readonly ItemStack[], definitions: Readonly<Record<string, InventoryItemDefinition>>,
  canUse: (definition: InventoryItemDefinition) => boolean = () => true): readonly ItemStack[] {
  for (const weapon of items) {
    const firearm = definitions[weapon.itemId]?.firearm
    if (!firearm || weapon.quantity <= 0 || !definitions[firearm.ammunitionId]?.ammunition) continue
    if (!canUse(definitions[weapon.itemId]) || !canUse(definitions[firearm.ammunitionId])) continue
    const slot = items.findIndex(item => item.itemId === firearm.ammunitionId && item.quantity > 0)
    if (slot < 0) continue
    const ammunition = items[slot]
    return ammunition.quantity === 1
      ? items.filter((_, index) => index !== slot)
      : items.map((item, index) => index === slot ? { ...item, quantity: item.quantity - 1 } : item)
  }
  return items
}
