import assert from 'node:assert/strict'
import test from 'node:test'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { TravelService } from '../../src/app/services/world/TravelService.ts'
import { refreshContainersEachMorning } from '../../src/app/services/inventory/refreshContainersEachMorning.ts'
import { rollLoot } from '../../src/domain/inventory/loot.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, content } from '../helpers/content.mjs'

const stack = (itemId, quantity = 1) => ({ itemId, quantity })
const quantity = (items, id) => items.filter(item => item.itemId === id).reduce((sum, item) => sum + item.quantity, 0)
const halfVitals = () => ['health', 'energy', 'sanity'].map(id => ({ id, value: 50, max: 100 }))
const definitions = [
  { id: 'med', rarity: 'common', consumable: true, maxStack: 5 },
  { id: 'tool', rarity: 'uncommon' }, { id: 'gem', rarity: 'rare' },
]

test('rest restores 15 energy, sleep restores 50; cancel and repeat do nothing', () => {
  const status = new StatusService(halfVitals()), time = new DayTimeService()
  const rest = new RestService(time, status, content().ui.rest.energyRecovery)
  rest.open('rest', 'Bench')
  rest.close()
  rest.confirm()
  assert.equal(status.getSnapshot().health, 50)
  rest.open('rest', 'Bench')
  rest.confirm()
  assert.equal(status.getSnapshot().health, 50)
  assert.equal(status.getSnapshot().energy, 65)
  rest.confirm()
  assert.equal(status.getSnapshot().energy, 65)
  rest.open('sleep', 'Bed')
  rest.confirm()
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 100, sanity: 50 })
  assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 2, phase: 'morning' })
})

test('custom recovery amounts are honored independently of the defaults', () => {
  const status = new StatusService(halfVitals()), rest = new RestService(new DayTimeService(), status,
    { rest: { health: 99, energy: 3, sanity: 99 }, sleep: { health: 99, energy: 7, sanity: 99 } })
  rest.open('rest', 'Chair'); rest.confirm()
  rest.open('sleep', 'Bed'); rest.confirm()
  assert.equal(status.getSnapshot().energy, 74)
  assert.equal(status.getSnapshot().health, 100)
  assert.equal(status.getSnapshot().sanity, 100)
})

test('weighted loot follows rarity boundaries and removes selected IDs from later rolls', () => {
  const table = { itemIds: ['med', 'tool', 'gem'], minItems: 1, maxItems: 1, weights: { med: 60, tool: 30, gem: 10 } }
  for (const [roll, expected] of [[0, 'med'], [0.599, 'med'], [0.6, 'tool'], [0.899, 'tool'], [0.9, 'gem'], [0.999, 'gem']]) {
    let calls = 0
    assert.equal(rollLoot(table, () => calls++ === 0 ? 0 : roll)[0].itemId, expected)
  }
  const all = rollLoot({ ...table, minItems: 3, maxItems: 3 }, () => 0.999)
  assert.equal(new Set(all.map(item => item.itemId)).size, 3)
  assert.equal(all[0].itemId, 'gem')
})

test('container quality applies rarity weighting to both weighted and otherwise uniform tables', () => {
  const config = content().containers
  const table = { minItems: 1, maxItems: 1, itemIds: 'all' }
  const seeds = buildContainerSeeds({ ...config,
    placements: [{ id: 'weighted', type: 'trash', locationId: 'test', lootTable: 'weighted' },
      { id: 'uniform', type: 'trash', locationId: 'test', lootTable: 'uniform' },
      { id: 'manual', type: 'trash', locationId: 'test', items: [stack('tool')] }],
    lootTables: { weighted: { ...table, rarityWeighted: true }, uniform: table },
  }, definitions)
  assert.equal(seeds[0].loot.weights.med, 60)
  assert.equal(seeds[0].loot.weights.tool, 30 * config.types.trash.quality)
  assert.equal(seeds[0].loot.weights.gem, 10 * config.types.trash.quality ** 2)
  assert.deepEqual(seeds[1].loot.weights, seeds[0].loot.weights)
  assert.equal(seeds[2].loot, undefined)
})

test('morning refills replace generated loot and preserve deposits across repeated mornings', () => {
  const inventory = new InventoryService(definitions, [{ id: 'crate', name: 'Crate', locationId: 'test', items: [stack('med', 3)] }],
    () => 0, [stack('med', 2), stack('tool')])
  inventory.openContainer('crate')
  inventory.storeItem('med', 0)
  inventory.storeItem('tool', 0)
  inventory.refreshContainers()
  for (let morning = 0; morning < 3; morning++) {
    inventory.refreshContainers()
    assert.equal(quantity(inventory.getSnapshot().containers.crate.items, 'med'), 5)
    assert.equal(quantity(inventory.getSnapshot().containers.crate.items, 'tool'), 1)
  }
  inventory.takeItem('med')
  inventory.takeItem('tool')
  const carried = inventory.getSnapshot().items
  inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers.crate.items, [stack('med', 3)])
  assert.equal(inventory.getSnapshot().items, carried)
})

test('partial withdrawals preserve only the remaining deposited quantities', () => {
  const inventory = new InventoryService(definitions, [{ id: 'crate', name: 'Crate', locationId: 'test', items: [stack('med', 3)] }],
    () => 0, [stack('med', 2), ...Array.from({ length: 5 }, () => stack('tool'))])
  inventory.openContainer('crate')
  inventory.storeItem('med', 0)
  inventory.grantItems([stack('med', 4)])
  inventory.takeItem('med')
  assert.equal(quantity(inventory.getSnapshot().items, 'med'), 5)
  inventory.refreshContainers()
  assert.equal(quantity(inventory.getSnapshot().containers.crate.items, 'med'), 4, '3 generated plus 1 remaining deposit')
})

test('swaps update deposit ownership and safe storage in a manual empty container survives refresh', () => {
  const inventory = new InventoryService(definitions, [
    { id: 'crate', name: 'Crate', locationId: 'test', items: [stack('med')] },
    { id: 'safe', name: 'Safe', locationId: 'test', items: [] },
  ], () => 0, [stack('tool')])
  inventory.openContainer('crate')
  inventory.swapItems('tool', 'med')
  inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers.crate.items, [stack('med'), stack('tool')])
  inventory.openContainer('safe')
  inventory.storeItem('med')
  inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers.safe.items, [stack('med')])
})

test('random loot rerolls only on new mornings from rest, sleep or travel; reopening does not reroll', () => {
  for (const action of ['rest', 'sleep', 'travel']) {
    let randomCalls = 0
    const time = new DayTimeService(7, 'night')
    const inventory = new InventoryService(definitions, [{ id: 'crate', name: 'Crate', locationId: 'test',
      loot: { itemIds: ['med', 'gem'], minItems: 1, maxItems: 1 } }], () => { randomCalls++; return randomCalls <= 2 ? 0 : 0.999 })
    const unsubscribe = refreshContainersEachMorning(time, inventory)
    assert.equal(randomCalls, 2)
    inventory.openContainer('crate'); inventory.closeMenu(); inventory.openContainer('crate')
    assert.equal(randomCalls, 2)
    if (action === 'travel') {
      const travel = new TravelService([{ id: 'a', connections: { right: 'b' } }, { id: 'b', connections: { left: 'a' } }], time, 1)
      travel.openTravel('walk', 'right'); travel.travelTo('b')
      assert.equal(randomCalls, 2)
      travel.openTravel('walk', 'left'); travel.travelTo('a')
      assert.equal(randomCalls, 2)
      travel.openTravel('walk', 'right'); travel.travelTo('b')
    } else {
      const rest = new RestService(time)
      rest.open(action, 'Furniture'); rest.confirm()
    }
    assert.equal(randomCalls, 4)
    assert.deepEqual(inventory.getSnapshot().containers.crate.items, [stack('gem')])
    const morning = inventory.getSnapshot()
    time.advance()
    assert.equal(inventory.getSnapshot(), morning)
    unsubscribe()
    time.nextMorning()
    assert.equal(randomCalls, 4)
  }
})

test('all items have authored rarity; invalid rarities, weights, opt-in flags and recovery amounts fail validation', () => {
  for (const item of content().items) assert.ok(['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(item.rarity))
  for (const [mutate, pattern] of [
    [data => { data.items[0].rarity = 'mythic' }, /rarity/],
    [data => { data.containers.rarityWeights.common = 0 }, /rarityWeights.common/],
    [data => { data.containers.lootTables['rarity-scavenge'].rarityWeighted = 'yes' }, /rarityWeighted/],
    [data => { data.ui.rest.healthRecovery.rest = -1 }, /healthRecovery.rest/],
    [data => { data.ui.rest.healthRecovery.sleep = -1 }, /healthRecovery.sleep/],
  ]) {
    const { data, sources } = catalogue()
    mutate(data)
    assert.throws(() => validateContent(data, sources), pattern)
  }
})

 test('fixed caches activate daily random loot only after successful pickup and retain activation on load', () => {
  const data = content()
  const seeds = buildContainerSeeds(data.containers, data.items)
  const cache = seeds.find(seed => seed.refreshLoot && !seed.locked)
  assert.ok(cache)
  const inventory = new InventoryService(data.items, [cache], () => 0)
  const original = inventory.getSnapshot().containers[cache.id].items
  inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers[cache.id].items, original)
  inventory.openContainer(cache.id)
  inventory.closeMenu()
  inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers[cache.id].items, original)
  inventory.openContainer(cache.id)
  inventory.takeItem(original[0].itemId)
  assert.deepEqual(inventory.saveState().lootedCaches, [cache.id])
  const loaded = new InventoryService(data.items, [cache], () => 0)
  loaded.restoreState(inventory.saveState())
  const before = loaded.getSnapshot().containers[cache.id].items
  loaded.refreshContainers('night')
  assert.deepEqual(loaded.getSnapshot().containers[cache.id].items, before)
  loaded.refreshContainers()
  assert.deepEqual(loaded.getSnapshot().containers[cache.id].items, rollLoot(cache.refreshLoot, () => 0))
  loaded.refreshContainers()
  assert.deepEqual(loaded.getSnapshot().containers[cache.id].items, rollLoot(cache.refreshLoot, () => 0))
  for (const seed of seeds.filter(seed => seed.questId || seed.questIds?.length)) assert.equal(seed.refreshLoot, undefined)
})

test('failed cache pickup does not activate refresh and deposits survive activation', () => {
  const seed = { id: 'cache', name: 'Cache', locationId: 'test', restock: false,
    items: [stack('gem')], refreshLoot: { itemIds: ['med'], minItems: 1, maxItems: 1 } }
  const inventory = new InventoryService(definitions, [seed], () => 0, Array.from({ length: 6 }, () => stack('tool')))
  inventory.openContainer('cache')
  inventory.takeItem('gem')
  assert.deepEqual(inventory.saveState().lootedCaches, [])
  inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers.cache.items, [stack('gem')])
  inventory.storeItem('tool', 0)
  inventory.takeItem('gem')
  inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers.cache.items, [stack('med'), stack('tool')])
})
