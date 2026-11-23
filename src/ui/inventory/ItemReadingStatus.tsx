import type { InventoryController } from '../../app/contracts/inventory'

/**
 * Perform item reading status.
 * @param {{ itemId: string inventory: InventoryController }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ItemReadingStatus({ itemId, inventory }: {
  itemId: string
  inventory: InventoryController
}) {
  return <p>{inventory.getSnapshot().readBooks.includes(itemId)
    ? 'Read — bonus already learned.'
    : 'Unread — consume once for permanent bonuses.'}</p>
}
