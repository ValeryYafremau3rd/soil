import type { ContainerSeed,ItemStack } from '../../domain/inventory/loot'
import { quantityOf } from '../../domain/inventory/stacks.ts'
import type { InventorySnapshot,LootPickup } from '../contracts/inventory'
import type { SavedInventory } from '../contracts/save'
import { EventChannel } from './EventChannel.ts'
export class InventoryLedger {
private readonly snapshot: () => InventorySnapshot
constructor(snapshot: () => InventorySnapshot) { this.snapshot = snapshot }
legendaryBarterStock?: NonNullable<SavedInventory['legendaryBarterStock']>

readonly lootedCaches = new Set<string>()

readonly deposits = new Map<string, Map<string, number>>()

readonly temporaryContainers = new Set<string>()

reportLoot(container: ContainerSeed, before: readonly ItemStack[], after: readonly ItemStack[], deposits: ReadonlyMap<string, number>): void {
    if (container.vendor) return
    const items = [...new Set(before.map(item => item.itemId))].flatMap(itemId => {
      const quantity = quantityOf(before, itemId) - quantityOf(after, itemId) - (deposits.get(itemId) ?? 0)
      return quantity > 0 ? [{ itemId, quantity }] : []
    })
    if (items.length) {
      if (container.refreshLoot) this.lootedCaches.add(container.id)
      this.lootListeners.emit({ containerId: container.id, items })
    }
  }

reportDeposit(containerId: string, itemId: string, quantity: number): void {
    if (this.snapshot().containers[containerId].vendor || quantity <= 0) return
    this.depositListeners.emit({ containerId, items: [{ itemId, quantity }] })
  }

recordDeposit(containerId: string, itemId: string, amount: number): void {
    const stored = this.deposits.get(containerId) ?? new Map<string, number>()
    const quantity = Math.max(0, (stored.get(itemId) ?? 0) + amount)
    if (quantity) stored.set(itemId, quantity)
    else stored.delete(itemId)
    this.deposits.set(containerId, stored)
  }

subscribeLoot = (listener: (pickup: LootPickup) => void): (() => void) => {
    return this.lootListeners.subscribe(listener)
  }

subscribeDeposit = (listener: (deposit: LootPickup) => void): (() => void) => {
    return this.depositListeners.subscribe(listener)
  }

readonly lootListeners = new EventChannel<[LootPickup]>()

readonly depositListeners = new EventChannel<[LootPickup]>()
}
