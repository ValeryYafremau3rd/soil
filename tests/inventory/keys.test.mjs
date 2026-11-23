import assert from 'node:assert/strict'
import test from 'node:test'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { content, catalogue } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { LockpickingService } from '../../src/app/services/puzzles/LockpickingService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { validateClasses } from '../../src/domain/skills/character.ts'

const data = content()
function inventoryFor(entry = classes[0]) {
  return new InventoryService(data.items, [{ id: 'storage', name: 'Storage', locationId: 'test' }], () => 0,
    entry.startingItems.map(itemId => ({ itemId, quantity: entry.startingItemQuantities?.[itemId] ?? 1 })),
    undefined, undefined, undefined, undefined, () => 99)
}

test('every class starts with one keyring containing apartment 21 and its building keys within six slots', () => {
  validateClasses(classes, data.items.map(item => item.id))
  const ring = data.items.find(item => item.id === 'key-ring')
  assert.deepEqual(ring.keys.map(key => key.doorId), ['apartments:apartment-21', 'apartments'])
  for (const entry of classes) {
    const inventory = inventoryFor(entry)
    assert.ok(inventory.getSnapshot().items.length <= 6)
    assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId === 'key-ring'), [{ itemId: 'key-ring', quantity: 1 }])
    assert.equal(inventory.hasDoorKey('apartments'), true)
    assert.equal(inventory.hasDoorKey('apartments:apartment-21'), true)
    assert.equal(inventory.hasDoorKey('living-barracks'), false)
  }
})

test('using keys opens the list without consumption and exchanges retain their normal transfer behavior', () => {
  const inventory = inventoryFor()
  const slot = inventory.getSnapshot().items.findIndex(item => item.itemId === 'key-ring')
  inventory.useItem(slot)
  assert.equal(inventory.getSnapshot().menu, null, 'out-of-menu use is ignored')
  inventory.openInventory()
  const items = inventory.getSnapshot().items
  inventory.useItem(slot)
  assert.deepEqual(inventory.getSnapshot().menu, { kind: 'keys', itemId: 'key-ring' })
  inventory.useItem(slot)
  assert.equal(inventory.getSnapshot().items, items)
  inventory.openInventory()
  assert.deepEqual(inventory.getSnapshot().menu, { kind: 'inventory' })
  inventory.openContainer('storage')
  inventory.useItem(slot)
  assert.deepEqual(inventory.getSnapshot().menu, { kind: 'container', containerId: 'storage' })
  inventory.storeItem('key-ring', slot)
  assert.equal(inventory.hasDoorKey('apartments'), false, 'stored keys do not count as carried')
  inventory.takeItem('key-ring', 0)
  assert.equal(inventory.hasDoorKey('apartments'), true)
})

test('carried keys open matching nighttime doors without lockpicks; other doors and containers stay locked', () => {
  const inventory = inventoryFor()
  let consumed = 0
  const time = new DayTimeService(1, 'night')
  const locks = new LockpickingService(time, () => 0, data.skills, { has: () => true, consume: () => { consumed++; return true } }, () => 0, () => 0, undefined, inventory.hasDoorKey)
  assert.equal(locks.attempt('apartments', 'Apartment building'), true)
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.equal(consumed, 0)
  assert.equal(locks.isLocked('apartments:apartment-11', 'apartment-11'), true)
  assert.equal(locks.attempt('living-barracks', 'Barracks'), false)
  assert.ok(locks.getSnapshot().puzzle)
  locks.close()
  assert.equal(consumed, 1)
  locks.attemptContainer('apartments', 'Locked container', () => {})
  assert.ok(locks.getSnapshot().puzzle, 'door keys cannot bypass a container lock')
  locks.close()
  const saved = inventory.saveState()
  inventory.removeItems([{ itemId: 'key-ring', quantity: 1 }])
  assert.equal(locks.isLocked('apartments'), true)
  inventory.restoreState(saved)
  time.nextMorning()
  assert.equal(locks.attempt('apartments:apartment-21', 'Apartment 21', 'apartment-21'), true)
  assert.equal(locks.isLocked('apartments:apartment-12', 'apartment-12'), true)
  inventory.removeItems([{ itemId: 'key-ring', quantity: 1 }])
  assert.equal(locks.isLocked('apartments:apartment-21', 'apartment-21'), true)
  inventory.restoreState(saved)
  time.nextMorning(); time.advance(); time.advance(); time.advance()
  assert.equal(locks.isLocked('apartments'), false, 'key access persists on later nights and after restoration')
})

test('authored key lists validate key IDs, names, and door references', () => {
  for (const patch of [
    keys => { keys[0].doorId = 'missing' },
    keys => { keys[1].id = keys[0].id },
    keys => { keys[0].name = '' },
  ]) {
    const { data, sources } = catalogue()
    patch(data.items.find(item => item.id === 'key-ring').keys)
    assert.throws(() => validateContent(data, sources), /key-ring.json.*keys/)
  }
})

test('Dusan keys attach to the existing ring without another slot and persist with ring storage', () => {
  const inventory = inventoryFor()
  inventory.grantItems([{ itemId: 'boris-apartment-keys', quantity: 1 }])
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'boris-apartment-keys'), false)
  assert.equal(inventory.getSnapshot().items.filter(item => item.itemId === 'key-ring').length, 1)
  assert.equal(inventory.hasDoorKey('apartments:apartment-12'), true)
  assert.equal(inventory.getKeys('key-ring').filter(key => key.doorId === 'apartments').length, 1)
  const saved = inventory.saveState()
  const restored = inventoryFor()
  restored.restoreState(saved)
  assert.equal(restored.hasDoorKey('apartments:apartment-12'), true)
  restored.openContainer('storage'); restored.storeItem('key-ring')
  assert.equal(restored.hasDoorKey('apartments:apartment-12'), false)
  restored.takeItem('key-ring')
  assert.equal(restored.hasDoorKey('apartments:apartment-12'), true)
  const before = restored.getSnapshot().items.length
  restored.grantItems([{ itemId: 'boris-apartment-keys', quantity: 1 }])
  assert.equal(restored.getSnapshot().items.length, before)
  assert.deepEqual(restored.saveState().keyItems, ['boris-apartment-keys'])
})

test('key attachment is atomic with quest rewards and migrates old separate carried keys', () => {
  const inventory = new InventoryService(data.items, [], () => 0,
    ['key-ring', 'smuggled-core', 'hammer', 'wrench', 'oil', 'duct-tape'].map(itemId => ({ itemId, quantity: 1 })))
  const reward = [{ itemId: 'boris-apartment-keys', quantity: 1 }, { itemId: 'triquetra-pendant', quantity: 1 }]
  assert.equal(inventory.tryExchangeItems([], reward), false)
  assert.equal(inventory.hasDoorKey('apartments:apartment-12'), false)
  assert.equal(inventory.tryExchangeItems([{ itemId: 'smuggled-core', quantity: 1 }, { itemId: 'oil', quantity: 1 }], reward, 20), true)
  assert.equal(inventory.getSnapshot().items.length, 6)
  assert.equal(inventory.hasDoorKey('apartments:apartment-12'), true)
  const legacy = inventory.saveState()
  legacy.money = 0
  delete legacy.keyItems
  legacy.items = [{ itemId: 'key-ring', quantity: 1 }, { itemId: 'boris-apartment-keys', quantity: 1 }]
  inventory.restoreState(legacy)
  assert.deepEqual(inventory.getSnapshot().items, [{ itemId: 'key-ring', quantity: 1 }])
  assert.equal(inventory.hasDoorKey('apartments:apartment-12'), true)
})
