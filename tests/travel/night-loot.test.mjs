import assert from 'node:assert/strict'
import test from 'node:test'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { refreshContainersEachMorning } from '../../src/app/services/inventory/refreshContainersEachMorning.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { content } from '../helpers/content.mjs'

const definitions = [{ id: 'loot', maxStack: 5 }, { id: 'keepsake' }]
const seeds = [
  { id: 'outside', name: 'Street crate', locationId: 'test', space: 'outside', loot: { itemIds: ['loot'], minItems: 1, maxItems: 1 } },
  { id: 'inside', name: 'Room crate', locationId: 'test', space: 'inside', items: [{ itemId: 'loot', quantity: 2 }] },
  { id: 'shop', name: 'Shop', locationId: 'test', vendor: true, items: [{ itemId: 'loot', quantity: 3 }] },
]

test('outdoor loot appears only on entering night and clears in morning; other stock refreshes in morning', () => {
  let rolls = 0
  const inventory = new InventoryService(definitions, seeds, () => { rolls++; return 0 })
  const time = new DayTimeService()
  const stop = refreshContainersEachMorning(time, inventory)
  const items = id => inventory.getSnapshot().containers[id].items
  assert.deepEqual(items('outside'), [])
  assert.equal(rolls, 0, 'daytime initialization does not generate outdoor loot')
  inventory.openContainer('inside'); inventory.takeAll(); inventory.closeMenu()
  time.advance(); time.advance()
  assert.deepEqual(items('outside'), [])
  time.advance()
  assert.deepEqual(items('outside'), [{ itemId: 'loot', quantity: 1 }])
  assert.deepEqual(items('inside'), [], 'night does not refresh indoor containers')
  const nightRolls = rolls
  inventory.openContainer('outside'); inventory.takeAll(); inventory.closeMenu()
  inventory.openContainer('outside'); inventory.closeMenu()
  assert.deepEqual(items('outside'), [])
  assert.equal(rolls, nightRolls, 'opening containers cannot reroll loot')
  time.advance()
  assert.deepEqual(items('outside'), [])
  assert.deepEqual(items('inside'), [{ itemId: 'loot', quantity: 2 }])
  assert.deepEqual(items('shop'), [{ itemId: 'loot', quantity: 3 }])
  time.advance(); time.advance(); time.advance()
  assert.deepEqual(items('outside'), [{ itemId: 'loot', quantity: 1 }])
  time.advance()
  assert.deepEqual(items('outside'), [], 'unclaimed loot disappears at morning')
  stop()
})

test('outdoor player deposits survive sunrise and do not duplicate on later nights', () => {
  const inventory = new InventoryService(definitions, seeds, () => 0, [{ itemId: 'keepsake', quantity: 1 }])
  const time = new DayTimeService(1, 'evening')
  refreshContainersEachMorning(time, inventory)
  inventory.openContainer('outside'); inventory.storeItem('keepsake'); inventory.closeMenu()
  for (let day = 0; day < 3; day++) {
    if (day) { time.advance(); time.advance() }
    time.advance()
    assert.deepEqual(inventory.getSnapshot().containers.outside.items, [{ itemId: 'loot', quantity: 1 }, { itemId: 'keepsake', quantity: 1 }])
    time.advance()
    assert.deepEqual(inventory.getSnapshot().containers.outside.items, [{ itemId: 'keepsake', quantity: 1 }])
  }
})

test('sleeping past night does not generate outdoor loot; night initialization and restore preserve depletion', () => {
  let rolls = 0
  const random = () => { rolls++; return 0 }
  const inventory = new InventoryService(definitions, seeds, random)
  const time = new DayTimeService(1, 'evening')
  refreshContainersEachMorning(time, inventory)
  const rest = new RestService(time)
  rest.open('sleep', 'Bed'); rest.confirm()
  assert.deepEqual(inventory.getSnapshot().containers.outside.items, [])
  assert.equal(rolls, 0)
  const night = new InventoryService(definitions, seeds, random, [], undefined, undefined, undefined, undefined, undefined, true)
  assert.deepEqual(night.getSnapshot().containers.outside.items, [{ itemId: 'loot', quantity: 1 }])
  night.openContainer('outside'); night.takeAll(); night.closeMenu()
  const saved = night.saveState()
  const loaded = new InventoryService(definitions, seeds, random, [], undefined, undefined, undefined, undefined, undefined, true)
  loaded.restoreState(saved)
  const loadedTime = new DayTimeService(1, 'night')
  refreshContainersEachMorning(loadedTime, loaded)
  assert.deepEqual(loaded.getSnapshot().containers.outside.items, [], 'loading a depleted night container does not refill it')
  loadedTime.advance(); loadedTime.advance(); loadedTime.advance(); loadedTime.advance()
  assert.deepEqual(loaded.getSnapshot().containers.outside.items, [{ itemId: 'loot', quantity: 1 }])
})

test('authored container placement space reaches inventory seeds', () => {
  const data = content()
  const seeds = buildContainerSeeds(data.containers, data.items)
  for (const seed of seeds) assert.equal(seed.space, data.containers.placements.find(p => p.id === seed.id).space)
  assert.ok(seeds.some(seed => seed.space === 'outside'))
  assert.ok(seeds.some(seed => seed.space === 'inside'))
})
