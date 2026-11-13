import skillConfig from '../../content/skills.json' with { type: 'json' }
import type { ItemSkills } from '../../domain/inventory/items'
import { itemHasStats } from '../../domain/inventory/items.ts'
import type { ContainerSeed,ItemStack } from '../../domain/inventory/loot'
import { normalizeStacks,rollLoot,seedContainer } from '../../domain/inventory/loot.ts'
import { quantityOf } from '../../domain/inventory/stacks.ts'
import { legendarySkill } from '../../domain/skills/effects.ts'
import type { InventoryAccess } from './InventoryAccess.ts'
import type { InventoryLedger } from './InventoryLedger.ts'
interface InventoryStockAccess extends InventoryAccess { readonly ledger: InventoryLedger; skills(): ItemSkills; random(): number; readonly seeds: readonly ContainerSeed[] }
export class InventoryStock {
private readonly inventory: InventoryStockAccess
constructor(inventory: InventoryStockAccess) { this.inventory = inventory }
private withoutLegendaryStock(items: readonly ItemStack[]): ItemStack[] {
    const remaining = new Map(this.inventory.ledger.legendaryBarterStock?.items.map(item => [item.itemId, item.quantity]) ?? [])
    return [...items].reverse().flatMap(item => {
      const removed = Math.min(item.quantity, remaining.get(item.itemId) ?? 0)
      remaining.set(item.itemId, (remaining.get(item.itemId) ?? 0) - removed)
      return item.quantity > removed ? [{ ...item, quantity: item.quantity - removed }] : []
    }).reverse()
  }

syncLegendaryStock = (): void => {
    const id = skillConfig.legendary.barter.vendorId, container = this.inventory.snapshot.containers[id]
    if (!container) return
    const active = legendarySkill(this.inventory.skills(), 'barter')
    if (active && !this.inventory.ledger.legendaryBarterStock) {
      const ammunition = skillConfig.legendary.barter.ammunition
      const quantity = Math.max(0, ammunition.quantity - quantityOf(container.items, ammunition.itemId))
      const items: ItemStack[] = quantity ? [{ itemId: ammunition.itemId, quantity }] : []
      const pool = Object.values(this.inventory.definitions).filter(item => itemHasStats(item) && item.saleable !== false && !item.ammunition && !item.attachToKeyRing
        && !container.items.some(stack => stack.itemId === item.id))
      items.push(...rollLoot({ itemIds: pool.map(item => item.id), minItems: skillConfig.legendary.barter.minItems,
        maxItems: skillConfig.legendary.barter.maxItems }, this.inventory.random))
      this.inventory.ledger.legendaryBarterStock = { visible: false, items }
    }
    if (!this.inventory.ledger.legendaryBarterStock || active === this.inventory.ledger.legendaryBarterStock.visible) return
    const items = active ? [...container.items, ...this.inventory.ledger.legendaryBarterStock.items] : this.withoutLegendaryStock(container.items)
    this.inventory.ledger.legendaryBarterStock = { ...this.inventory.ledger.legendaryBarterStock, visible: active }
    this.inventory.publish({ ...this.inventory.snapshot, containers: { ...this.inventory.snapshot.containers, [id]: { ...container, items } } })
  }

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
      const generated = (outdoor && phase === 'morning' ? [] : seedContainer(cache ? { ...seed, items: [], loot: seed.refreshLoot } : seed, this.inventory.random, this.inventory.stackLimit))
        .filter(item => !seed.vendor || this.inventory.stackLimit(item.itemId) > 1)
      const rerollVendor = phase === 'morning' && seed.id === skillConfig.legendary.barter.vendorId
      const fixed = seed.vendor ? (rerollVendor ? seed.items ?? [] : containers[seed.id].items).filter(item => this.inventory.stackLimit(item.itemId) === 1) : []
      const stored = [...(this.inventory.ledger.deposits.get(seed.id) ?? [])].map(([itemId, quantity]) => ({ itemId, quantity }))
      const replenished = seed.vendor ? generated.map(item => ({ ...item,
        quantity: Math.min(item.quantity, Math.max(0, this.inventory.stackLimit(item.itemId) - quantityOf(stored, item.itemId))),
      })).filter(item => item.quantity > 0) : generated
      containers[seed.id] = { ...containers[seed.id], items: normalizeStacks([
        ...fixed, ...replenished, ...stored.filter(item => rerollVendor || !seed.vendor || this.inventory.stackLimit(item.itemId) > 1),
      ], this.inventory.stackLimit) }
    }
    this.inventory.publish({ ...this.inventory.snapshot, containers })
    this.syncLegendaryStock()
  }
}
