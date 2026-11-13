import { ITEM_BY_ID } from '../../content/items'
import type { InventoryController } from '../../app/contracts/inventory'

export function ItemPrice({ itemId, inventory, selling = true }: { itemId: string; inventory: InventoryController; selling?: boolean }) {
  const item = ITEM_BY_ID[itemId]
  if (selling && item.saleable === false) return <span>Cannot be sold</span>
  return <span>Price: {inventory.getPrice(itemId, selling)}</span>
}
