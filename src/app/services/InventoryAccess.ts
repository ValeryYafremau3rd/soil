import type { InventoryItemDefinition } from '../../domain/inventory/items'
import type { InventorySnapshot } from '../contracts/inventory'

/** Internal inventory capabilities; UI and game continue to use InventoryController. */
export interface InventoryAccess {
  readonly snapshot: InventorySnapshot
  readonly definitions: Readonly<Record<string, InventoryItemDefinition>>
  stackLimit(id: string): number
  publish(snapshot: InventorySnapshot): void
}
