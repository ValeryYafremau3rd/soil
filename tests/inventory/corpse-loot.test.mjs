import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { rollCorpseLoot } from '../../src/domain/combat/patrolCombat.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

const data = content()
const body = { id: 'corpse:center:1', name: 'Militia corpse', locationId: 'center', items: [
  { itemId: 'pistol-ammunition', quantity: 2 }, { itemId: 'bandage', quantity: 2 },
] }

test('human corpse drops use independent configured probabilities', () => {
  const expected = [
    ['pistol-ammunition', 0.5], ['bandage', 0.5], ['red-cigarettes', 0.5],
    ['red-star', 0.05], ['leather-belt', 0.05], ['leather-boots', 0.05],
  ].map(([itemId, chance]) => ({ itemId, min: 1, max: 1, chance }))
  for (const type of ['patrol', 'solider']) {
    const drops = data.patrols.types[type].corpseLoot
    assert.deepEqual(drops, expected)
    assert.deepEqual(rollCorpseLoot(drops, () => 0), expected.map(({ itemId }) => ({ itemId, quantity: 1 })))
    assert.deepEqual(rollCorpseLoot(drops, () => 0.5), [])
    assert.deepEqual(rollCorpseLoot(drops, () => 0.05), expected.slice(0, 3).map(({ itemId }) => ({ itemId, quantity: 1 })))
    for (const drop of drops) {
      assert.equal(rollCorpseLoot([drop], () => drop.chance - 0.0001).length, 1)
      assert.deepEqual(rollCorpseLoot([drop], () => drop.chance), [])
    }
  }
  assert.deepEqual(rollCorpseLoot([{ itemId: 'bandage', min: 0, max: 2 }], () => 1),
    [{ itemId: 'bandage', quantity: 2 }], 'legacy quantity rolls remain supported')
})
test('corpse pickup respects partial stacks and capacity, pays nothing and cannot duplicate or refill', () => {
  const messages = []
  const inventory = new InventoryService(data.items, [], () => 0, [
    { itemId: 'pistol-ammunition', quantity: 4 }, { itemId: 'money', quantity: 8 },
    ...['key-ring', 'rope', 'flask', 'lighter'].map(itemId => ({ itemId, quantity: 1 })),
  ], undefined, undefined, undefined, message => messages.push(message))
  inventory.addTemporaryContainer(body)
  inventory.openContainer(body.id)
  inventory.closeMenu()
  assert.deepEqual(inventory.getSnapshot().containers[body.id].items, body.items, 'cancel keeps loot')
  inventory.openContainer(body.id)
  inventory.takeAll()
  assert.equal(inventory.getSnapshot().items[0].quantity, 5)
  assert.deepEqual(inventory.getSnapshot().containers[body.id].items, [
    { itemId: 'pistol-ammunition', quantity: 1 }, { itemId: 'bandage', quantity: 2 },
  ])
  inventory.takeItem('bandage')
  inventory.takeAll()
  assert.ok(messages.some(message => /No free room/.test(message)))
  assert.equal(inventory.getSnapshot().money, 8)
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }, { itemId: 'flask', quantity: 1 }])
  inventory.takeAll()
  assert.deepEqual(inventory.getSnapshot().containers[body.id].items, [])
  inventory.closeMenu()
  inventory.addTemporaryContainer(body)
  inventory.refreshContainers('morning'); inventory.refreshContainers('night')
  inventory.openContainer(body.id); inventory.takeAll()
  assert.deepEqual(inventory.getSnapshot().containers[body.id].items, [], 'reopening, duplicate registration and phases never reroll')
  assert.equal(inventory.getSnapshot().items.filter(item => item.itemId === 'pistol-ammunition').reduce((sum, item) => sum + item.quantity, 0), 6)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'bandage').quantity, 2)
})

test('corpses accept no deposits or swaps, are excluded from saves, and clean up only temporary containers', () => {
  const inventory = new InventoryService(data.items, [{ id: 'stash', name: 'Stash', locationId: 'center', items: [] }], () => 0,
    [{ itemId: 'bread', quantity: 1 }])
  inventory.addTemporaryContainer(body)
  inventory.openContainer(body.id)
  const before = inventory.getSnapshot()
  inventory.storeItem('bread'); inventory.swapItems('bread', 'bandage')
  assert.deepEqual(inventory.getSnapshot(), before)
  inventory.takeItem('bandage')
  const saved = inventory.saveState()
  assert.equal(saved.containers[body.id], undefined)
  assert.equal(saved.deposits[body.id], undefined)
  assert.ok(saved.items.some(item => item.itemId === 'bandage'), 'collected loot is saved')
  inventory.removeTemporaryContainer('stash')
  assert.ok(inventory.getSnapshot().containers.stash)
  inventory.removeTemporaryContainer(body.id)
  inventory.removeTemporaryContainer(body.id)
  assert.equal(inventory.getSnapshot().menu, null)
  assert.equal(inventory.getSnapshot().containers[body.id], undefined)
  inventory.addTemporaryContainer(body)
  inventory.restoreState(saved)
  assert.equal(inventory.getSnapshot().containers[body.id], undefined, 'load discards visit-local corpses')
})

test('temporary containers reject authored ID collisions and invalid loot atomically; empty bodies are valid', () => {
  const inventory = new InventoryService(data.items, [{ id: 'stash', name: 'Stash', locationId: 'center', items: [] }])
  const before = inventory.getSnapshot()
  for (const invalid of [{ ...body, id: 'stash' }, { ...body, items: [{ itemId: 'missing', quantity: 1 }] },
    { ...body, items: [{ itemId: 'bandage', quantity: 0 }] }]) {
    assert.throws(() => inventory.addTemporaryContainer(invalid))
    assert.deepEqual(inventory.getSnapshot(), before)
  }
  inventory.addTemporaryContainer({ ...body, items: [] })
  inventory.openContainer(body.id); inventory.takeAll()
  assert.deepEqual(inventory.getSnapshot().containers[body.id].items, [])
})

test('corpse drop content validates item references, ranges and duplicate item IDs', () => {
  for (const mutate of [
    drops => { drops[0].itemId = 'missing' },
    drops => { drops[0].min = -1 },
    drops => { drops[0].min = 3 },
    drops => { drops[0].max = 1.5 },
    drops => { drops[1].itemId = drops[0].itemId },
  ]) {
    const { data, sources } = catalogue()
    mutate(data.patrols.types.patrol.corpseLoot)
    assert.throws(() => validateContent(data, sources), /corpseLoot/)
  }
})
