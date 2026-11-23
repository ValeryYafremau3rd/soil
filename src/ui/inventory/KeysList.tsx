import type { InventoryItemDefinition } from '../../domain/inventory/items'
import { ItemIcon } from './ItemIcon'
import './inventory.css'

/**
 * Perform keys list.
 * @param {{ keys: NonNullable<InventoryItemDefinition['keys']> }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function KeysList({ keys }: {
  keys: NonNullable<InventoryItemDefinition['keys']>
}) {
  return <>
    <p>Your carried keys open their matching doors automatically.</p>
    <ul className="keys-list" aria-label="Your keys">
      {keys.map(key => <li className="keys-list__item" key={key.doorId}>
        <ItemIcon itemId="small-key" />
        <span>{key.name}</span>
      </li>)}
    </ul>
    {!keys.length && <p>No keys carried.</p>}
  </>
}
