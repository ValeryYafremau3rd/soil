import skillConfig from '../../../content/skills.json' with { type: 'json' }
import type { ItemSkills } from '../../../domain/inventory/items'
import type { ContainerSeed, ItemStack } from '../../../domain/inventory/loot'
import { normalizeStacks, seedContainer } from '../../../domain/inventory/loot.ts'
import { quantityOf } from '../../../domain/inventory/stacks.ts'
import type { InventoryAccess } from './InventoryAccess.ts'
import type { InventoryLedger } from './InventoryLedger.ts'
/**
 * Narrow inventory stock capabilities injected into a collaborating service.
 */
interface InventoryStockAccess extends InventoryAccess {
  readonly ledger: InventoryLedger
  skills(): ItemSkills
  random(): number
  readonly seeds: readonly ContainerSeed[]
}

/**
 * Owns inventory stock state and behavior.
 */
export class InventoryStock {
  private readonly inventory: InventoryStockAccess

  /**
   * Initialize the InventoryStock instance and its collaborators.
   * @param {InventoryStockAccess} inventory - Inventory capability used to read or transact items.
   * @returns {InventoryStock} The initialized instance.
   */
  constructor(inventory: InventoryStockAccess) {
    this.inventory = inventory
  }

  /**
   * Perform without legendary stock for InventoryStock.
   * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
   * @returns {ItemStack[]} The result described by the TypeScript return signature.
   */
  private withoutLegendaryStock(items: readonly ItemStack[]): ItemStack[] {
    const remaining = new Map(this.inventory.ledger.legendaryBarterStock?.items.map(item => [item.itemId, item.quantity]) ?? [])

    return [...items].reverse().flatMap(item => {
      const removed = Math.min(item.quantity, remaining.get(item.itemId) ?? 0)
      remaining.set(item.itemId, (remaining.get(item.itemId) ?? 0) - removed)

      return item.quantity > removed ? [{ ...item, quantity: item.quantity - removed }] : []
    }).reverse()
  }

  /**
   * Perform sync legendary stock for InventoryStock.
   * @returns {void} Completes the operation without returning a value.
   */
  syncLegendaryStock = (): void => {
    const id = skillConfig.legendary.barter.vendorId, container = this.inventory.snapshot.containers[id]
    if (!container) return

    // Retire legacy perk stock without removing goods deposited by the player.
    if (!this.inventory.ledger.legendaryBarterStock?.visible) return

    const items = this.withoutLegendaryStock(container.items)
    this.inventory.ledger.legendaryBarterStock = {
      ...this.inventory.ledger.legendaryBarterStock,
      visible: false
    }
    this.inventory.publish({
      ...this.inventory.snapshot,
      containers: { ...this.inventory.snapshot.containers, [id]: { ...container, items } }
    })
  }

  /**
   * Perform refresh containers for InventoryStock.
   * @param {"morning" | "night"} phase - The phase supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  refreshContainers = (phase: 'morning' | 'night' = 'morning'): void => {
    const containers = { ...this.inventory.snapshot.containers }
    if (phase === 'morning') {
      const id = skillConfig.legendary.barter.vendorId
      if (this.inventory.ledger.legendaryBarterStock?.visible && containers[id]) containers[id] = { ...containers[id], items: this.withoutLegendaryStock(containers[id].items) }

      this.inventory.ledger.legendaryBarterStock = undefined
    }

    for (const seed of this.inventory.seeds) {
      const cache = seed.refreshLoot && this.inventory.ledger.lootedCaches.has(seed.id)
      if (seed.restock === false && !cache) continue

      if (cache && phase !== 'morning') continue

      const outdoor = !cache && (seed.nightOnly || seed.space === 'outside' && !seed.vendor)
      if (phase === 'night' && !outdoor) continue

      const generated = (outdoor && phase === 'morning' ? [] : seedContainer(
        cache ? { ...seed, items: [], loot: seed.refreshLoot } : seed,
        this.inventory.random,
        this.inventory.stackLimit
      ))
        .filter(item => !seed.vendor || seed.loot?.offers || this.inventory.stackLimit(item.itemId) > 1)
      const rerollVendor = phase === 'morning' && seed.id === skillConfig.legendary.barter.vendorId
      const fixed = seed.vendor && !seed.loot?.offers ? (rerollVendor ? seed.items ?? [] : containers[seed.id].items).filter(item => this.inventory.stackLimit(item.itemId) === 1) : []
      const stored = [...(this.inventory.ledger.deposits.get(seed.id) ?? [])].map(([itemId, quantity]) => ({ itemId, quantity }))
      const replenished = seed.vendor ? generated.map(item => ({
        ...item,
        quantity: Math.min(
          item.quantity,
          Math.max(0, this.inventory.stackLimit(item.itemId) - quantityOf(stored, item.itemId))
        ),
      })).filter(item => item.quantity > 0) : generated
      containers[seed.id] = {
        ...containers[seed.id],
        items: normalizeStacks(
          [
            ...fixed,
            ...replenished,
            ...stored.filter(item => seed.loot?.offers || rerollVendor || !seed.vendor || this.inventory.stackLimit(item.itemId) > 1),
          ],
          this.inventory.stackLimit
        )
      }
    }

    this.inventory.publish({ ...this.inventory.snapshot, containers })
    this.syncLegendaryStock()
  }
}
