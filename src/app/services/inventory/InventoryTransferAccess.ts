import type { equipReceived, receiveItem } from '../../../domain/inventory/equipment'
import type { Equipment } from '../../../domain/inventory/items'
import type { attachKeyItems } from '../../../domain/inventory/keys'
import type { ItemStack } from '../../../domain/inventory/loot'
import type { StatisticsController } from '../../contracts/statistics'
import type { InventoryAccess } from './InventoryAccess'
import type { InventoryLedger } from './InventoryLedger'

/**
 * Narrow inventory transfer capabilities injected into a collaborating service.
 */
export interface InventoryTransferAccess extends InventoryAccess {
  readonly ledger: InventoryLedger
  canTake(containerId: string, itemId: string): boolean | string
  notify(text: string): void
  getCapacity(): number
  getPrice(itemId: string, selling?: boolean): number
  attachKeys(
    items: readonly ItemStack[],
    keyItems?: readonly string[]
  ): ReturnType<typeof attachKeyItems>
  equipReceived(
    items: readonly ItemStack[],
    equipment: Equipment
  ): ReturnType<typeof equipReceived>
  receiveItem(
    items: readonly ItemStack[],
    source: readonly ItemStack[],
    itemId: string,
    equipment: Equipment,
    slot: number,
    maxQuantity?: number
  ): ReturnType<typeof receiveItem>
  canFitInventory(items: readonly ItemStack[]): boolean
  onStatistic: StatisticsController['record']
  onPurchased?(itemId: string): void
  onSold(): void
}
