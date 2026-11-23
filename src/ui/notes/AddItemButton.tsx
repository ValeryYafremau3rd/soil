import { useState } from 'react'
import type { InventoryController } from '../../app/contracts/inventory'

/**
 * Perform add item button.
 * @param {{ id: string inventory: InventoryController }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function AddItemButton({ id, inventory }: {
  id: string
  inventory: InventoryController
}) {
  const [message, setMessage] = useState('')

  return <div>
    <button type="button" onClick={() => {
      const added = inventory.tryExchangeItems([], [{ itemId: id, quantity: 1 }])
      setMessage(added ? 'Added one to inventory.' : 'No free room in inventory.')
    }}>Add</button>
    <p role="status">{message}</p>
  </div>
}
