import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { INVENTORY_CAPACITY, rollLoot, swapItems, transferItem } from '../../src/domain/inventory/loot.ts'
const config = content().containers
const CONTAINER_PLACEMENTS = config.placements.filter(placement => placement.enabled !== false)
const CONTAINER_SEEDS = buildContainerSeeds(config, content().items.map(item => item.id))
const UNLOCKED_SEEDS = CONTAINER_SEEDS.map(seed => ({ ...seed, locked: false }))

const items = content().items
const ids = items.map(item => item.id)
const lootTable = { itemIds: ids, minItems: 1, maxItems: 3 }

test('the item catalogue contains unique items and crops within the supplied sheet', () => {
  assert.ok(items.length > 0)
  assert.equal(new Set(ids).size, items.length)
  for (const { name, icon, description } of items) {
    assert.ok(name.length > 0)
    assert.ok(description?.length > 10, `${name} needs a description`)
    assert.ok(icon.width > 0 && icon.height > 0)
    assert.ok(icon.x >= 0 && icon.y >= 0 && icon.x + icon.width <= 1536 && icon.y + icon.height <= 1024)
  }
})

test('loot rolls one to three distinct items, including both limits', () => {
  assert.equal(rollLoot(lootTable, () => 0).length, 1)
  const three = rollLoot(lootTable, () => 0.999999)
  assert.equal(three.length, 3)
  assert.equal(new Set(three.map(item => item.itemId)).size, 3)
  assert.ok(three.every(item => item.quantity === 1 && ids.includes(item.itemId)))
  assert.deepEqual(rollLoot({ ...lootTable, itemIds: [] }, () => 0), [])
  assert.equal(rollLoot({ ...lootTable, itemIds: ['bandage'] }, () => 0.999999).length, 1)
})

test('pickup stacks identical items without mutating the original arrays', () => {
  const inventory = [{ itemId: 'bandage', quantity: 2 }]
  const source = [{ itemId: 'bandage', quantity: 1 }, { itemId: 'bread', quantity: 1 }]
  const result = transferItem(inventory, source, 'bandage', Infinity, () => 5)
  assert.deepEqual(result.inventory, [{ itemId: 'bandage', quantity: 3 }])
  assert.deepEqual(result.remaining, [{ itemId: 'bread', quantity: 1 }])
  assert.equal(inventory[0].quantity, 2)
  assert.equal(source.length, 2)
})

test('authored container placements seed valid manual and random contents', () => {
  const service = new InventoryService(items, CONTAINER_SEEDS)
  service.refreshContainers('night')
  const containers = service.getSnapshot().containers
  assert.deepEqual(Object.keys(containers).sort(), CONTAINER_PLACEMENTS.map(placement => placement.id).sort())
  for (const seed of CONTAINER_SEEDS) {
    const contents = containers[seed.id]
    assert.ok(contents.items.every(item => ids.includes(item.itemId) && item.quantity > 0))
    for (const manual of seed.items) {
      assert.ok(contents.items.find(item => item.itemId === manual.itemId).quantity >= manual.quantity)
    }
    assert.ok(contents.items.length <= seed.items.length + (seed.loot?.maxItems ?? 0))
    if (!seed.items.length && seed.loot) assert.ok(contents.items.length >= seed.loot.minItems)
  }
})

test('items cannot be collected twice, and reopening a container does not reroll loot', () => {
  const service = new InventoryService(items, UNLOCKED_SEEDS, () => 0)
  service.refreshContainers('night')
  service.openContainer('living-trash')
  const itemId = service.getSnapshot().containers['living-trash'].items[0].itemId
  service.takeItem(itemId)
  service.takeItem(itemId)
  assert.equal(service.getSnapshot().items[0].quantity, 1)
  service.closeMenu()
  service.openContainer('factory-trash')
  service.closeMenu()
  service.openContainer('living-trash')
  assert.deepEqual(service.getSnapshot().containers['living-trash'].items, [])
  assert.equal(service.getSnapshot().items[0].quantity, 1)
})

test('take all transfers the exact contents and ignores repeat pickup', () => {
  const service = new InventoryService(items, UNLOCKED_SEEDS, () => 0.999999)
  service.openContainer('factory-toolbox')
  const before = service.getSnapshot().containers['factory-toolbox'].items
  service.takeAll()
  assert.deepEqual(service.getSnapshot().items, before)
  assert.deepEqual(service.getSnapshot().containers['factory-toolbox'].items, [])
  service.takeAll()
  assert.equal(service.getSnapshot().items.length, 3)
})

test('inventory and container menus guard unknown sources and out-of-menu pickup', () => {
  const service = new InventoryService(items, CONTAINER_SEEDS, () => 0)
  const initial = service.getSnapshot()
  service.openContainer('missing')
  service.takeItem(ids[0])
  service.takeAll()
  assert.equal(service.getSnapshot(), initial)
  service.openInventory()
  service.takeItem(ids[0])
  assert.deepEqual(service.getSnapshot().items, [])
  service.closeMenu()
  assert.equal(service.getSnapshot().menu, null)
})

test('loot changes publish snapshots and unsubscribed listeners are released', () => {
  const service = new InventoryService(items, UNLOCKED_SEEDS, () => 0)
  service.refreshContainers('night')
  let calls = 0
  const unsubscribe = service.subscribe(() => { calls++ })
  service.openContainer('living-trash')
  service.takeAll()
  service.closeMenu()
  assert.equal(calls, 3)
  unsubscribe()
  service.openInventory()
  assert.equal(calls, 3)
})

test('empty item catalogues and duplicate container IDs are rejected', () => {
  assert.throws(() => new InventoryService([], CONTAINER_SEEDS), /at least one/)
  assert.throws(() => new InventoryService(items, [CONTAINER_SEEDS[0], CONTAINER_SEEDS[0]]), /unique/)
})

test('a manual container contains exactly the authored quantities without rolling random loot', () => {
  const seed = { id: 'manual', name: 'Medical crate', locationId: 'factory', items: [
    { itemId: 'bandage', quantity: 3 }, { itemId: 'bread', quantity: 2 },
  ] }
  const service = new InventoryService(items, [seed], () => { throw new Error('Manual loot must not use RNG') })
  assert.deepEqual(service.getSnapshot().containers.manual.items, seed.items)
  service.openContainer('manual')
  service.takeAll()
  assert.deepEqual(service.getSnapshot().items, seed.items)
})

test('manual and random loot combine and stack quantities of the same item', () => {
  const service = new InventoryService(items, [{
    id: 'mixed', name: 'Mixed crate', locationId: 'factory',
    items: [{ itemId: 'bandage', quantity: 2 }],
    loot: { itemIds: ['bandage'], minItems: 1, maxItems: 1 },
  }], () => 0)
  assert.deepEqual(service.getSnapshot().containers.mixed.items, [{ itemId: 'bandage', quantity: 3 }])
})

test('an explicit empty container stays empty', () => {
  const service = new InventoryService(items, [{ id: 'empty', name: 'Empty', locationId: 'factory', items: [] }])
  assert.deepEqual(service.getSnapshot().containers.empty.items, [])
})

function exchangeService(carried = 6) {
  const itemIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const initial = itemIds.slice(0, carried).map(itemId => ({ itemId, quantity: 1 }))
  const service = new InventoryService(itemIds.map(id => ({ id, consumable: true, maxStack: 5 })), [{
    id: 'exchange', name: 'Exchange', locationId: 'test', items: [
      { itemId: 'g', quantity: 2 }, { itemId: 'a', quantity: 3 }, { itemId: 'h', quantity: 4 },
    ],
  }], () => 0, initial)
  service.openContainer('exchange')
  return service
}

test('six inventory slots reject new types but allow matching stacks without removing blocked loot', () => {
  assert.equal(INVENTORY_CAPACITY, 6)
  const service = exchangeService()
  const before = service.getSnapshot()
  service.takeItem('g')
  assert.equal(service.getSnapshot(), before)
  service.takeItem('a')
  assert.equal(service.getSnapshot().items.length, 6)
  assert.equal(service.getSnapshot().items[0].quantity, 4)
  assert.deepEqual(service.getSnapshot().containers.exchange.items, [
    { itemId: 'g', quantity: 2 }, { itemId: 'h', quantity: 4 },
  ])
})

test('take all fills remaining slots and still merges later matching stacks, preserving overflow', () => {
  const service = exchangeService(5)
  service.takeAll()
  const snapshot = service.getSnapshot()
  assert.equal(snapshot.items.length, 6)
  assert.equal(snapshot.items.find(item => item.itemId === 'a').quantity, 4)
  assert.equal(snapshot.items.find(item => item.itemId === 'g').quantity, 2)
  assert.deepEqual(snapshot.containers.exchange.items, [{ itemId: 'h', quantity: 4 }])
  service.takeAll()
  assert.equal(service.getSnapshot(), snapshot)
})

test('storing transfers whole stacks, merges matches, and persists when reopening a container', () => {
  const service = exchangeService()
  service.storeItem('a')
  assert.equal(service.getSnapshot().items.length, 5)
  assert.equal(service.getSnapshot().containers.exchange.items.find(item => item.itemId === 'a').quantity, 4)
  service.storeItem('a')
  assert.equal(service.getSnapshot().containers.exchange.items.find(item => item.itemId === 'a').quantity, 4)
  service.closeMenu()
  service.openContainer('exchange')
  service.takeItem('g')
  assert.equal(service.getSnapshot().items.length, 6)
  assert.equal(service.getSnapshot().items.find(item => item.itemId === 'g').quantity, 2)
})

test('swapping while full publishes once and conserves every quantity including matching container items', () => {
  const service = exchangeService()
  const totals = snapshot => {
    const result = {}
    for (const item of [...snapshot.items, ...snapshot.containers.exchange.items]) result[item.itemId] = (result[item.itemId] ?? 0) + item.quantity
    return result
  }
  const before = service.getSnapshot()
  let notifications = 0
  service.subscribe(() => { notifications++ })
  service.swapItems('a', 'g')
  const after = service.getSnapshot()
  assert.equal(notifications, 1)
  assert.equal(after.items.length, 6)
  assert.equal(after.items.find(item => item.itemId === 'g').quantity, 2)
  assert.equal(after.containers.exchange.items.find(item => item.itemId === 'a').quantity, 4)
  assert.deepEqual(totals(after), totals(before))
  assert.equal(before.items[0].quantity, 1)
  service.swapItems('missing', 'h')
  assert.equal(service.getSnapshot(), after)
})

test('swap merges into an existing inventory stack and ignores identical or missing selections', () => {
  const inventory = [{ itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 3 }]
  const container = [{ itemId: 'b', quantity: 4 }]
  const result = swapItems(inventory, container, 'a', 'b', () => 5)
  assert.deepEqual(result.inventory, [{ itemId: 'b', quantity: 5 }, { itemId: 'b', quantity: 2 }])
  assert.deepEqual(result.container, [{ itemId: 'a', quantity: 2 }])
  assert.equal(swapItems(inventory, container, 'b', 'b').inventory, inventory)
  assert.equal(swapItems(inventory, container, 'a', 'missing').inventory, inventory)
})

test('store and swap are guarded outside an open container; oversized grants fail atomically', () => {
  const service = exchangeService()
  service.openInventory()
  const before = service.getSnapshot()
  service.storeItem('a')
  service.swapItems('a', 'g')
  assert.equal(service.getSnapshot(), before)
  assert.throws(() => service.grantItems([{ itemId: 'a', quantity: 1 }, { itemId: 'g', quantity: 1 }]), /six slots/)
  assert.equal(service.getSnapshot(), before)
  assert.throws(() => new InventoryService(['a'], [], () => 0,
    Array.from({ length: 7 }, (_, index) => ({ itemId: String(index), quantity: 1 }))), /six slots/)
})

