import { normalizeStacks } from '../../domain/inventory/loot.ts'
import type { SaveGame } from '../contracts/save'
import type { SaveReferences } from './saveReferences.ts'

export function migrateStoredItems(save: SaveGame, references: SaveReferences): void {
const splitBottles = (items: SaveGame['inventory']['items']) => items.flatMap(stack =>
    stack.quantity > 1 && stack.quantity <= (stack.itemId === 'shotgun-shells' ? 6 : 5) && references.items.some(item => item.id === stack.itemId && (item.category === 'Drink' || item.id === 'shotgun-shells') && item.maxStack === 1)
      ? normalizeStacks([stack], () => 1) : [stack])
save.inventory.items = splitBottles(save.inventory.items)
for (const container of Object.values(save.inventory.containers)) container.items = splitBottles(container.items)
const retiredIds = ['merchant:cashier-deliveries', ...['bartender', 'citizen-caretaker', 'citizen-mechanic', 'citizen-nurse', 'worker'].map(id => `night-courier-${id}-crate`), ...references.quests.filter(quest => quest.id.startsWith('night-courier-')).map(quest => `${quest.id}-crate`)]
const retiredShipments: Record<string, string> = {
    ...Object.fromEntries(retiredIds.map(id => [id, 'cashier-5-crate'])),
    'smuggler-center-crate': 'cashier-5-crate',
    'dusan-crate-center-crate': 'cashier-5-crate',
    'dusan-crate-living-district-crate': 'smuggler-living-crate',
    'barracks-roof-suitcase': 'living-taskboard-suitcase',
  }
{
    const containers = { ...save.inventory.containers }, deposits = { ...save.inventory.deposits }
    for (const [id, target] of Object.entries(retiredShipments)) {
      if (!references.containerIds.includes(target) || references.containerIds.includes(id) || !containers[id]) continue
      const current = containers[target] ?? { items: [], locked: false }
      if ([...current.items, ...containers[id].items].some(stack => !references.items.some(item => item.id === stack.itemId && stack.quantity <= (item.maxStack ?? 1)))) throw new Error('Save contains incompatible content')
      containers[target] = { locked: current.locked || containers[id].locked,
        items: normalizeStacks([...current.items, ...containers[id].items], id => references.items.find(item => item.id === id)?.maxStack ?? 1) }
      const totals = new Map<string, number>()
      for (const item of [...deposits[target] ?? [], ...deposits[id] ?? []]) totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.quantity)
      if (totals.size) deposits[target] = [...totals].map(([itemId, quantity]) => ({ itemId, quantity }))
      delete containers[id]
      delete deposits[id]
    }
    save.inventory = { ...save.inventory, containers, deposits }
    // Keep collected fixed caches renewable after their placement moves.
    if (save.inventory.lootedCaches) save.inventory.lootedCaches = [...new Set(save.inventory.lootedCaches.map(id => id === 'barracks-roof-suitcase' ? 'living-taskboard-suitcase' : id))]
  }
}
