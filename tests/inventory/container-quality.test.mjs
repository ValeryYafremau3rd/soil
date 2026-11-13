import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { rollLoot } from '../../src/domain/inventory/loot.ts'
import { roomContainerPlacements } from '../../src/app/content/roomContainerPlacements.ts'

test('every item and container type has integer quality from 1 to 5', () => {
  const data = content()
  for (const item of [...data.items, ...Object.values(data.containers.types)]) assert.ok(Number.isInteger(item.quality) && item.quality >= 1 && item.quality <= 5)
})

test('trash generates only statless items for explicit and all-item pools, even without restocking', () => {
  const data = content()
  const effects = [{ bonus: { attribute: 'physique', amount: 1 } }, { bonuses: [{ skill: 'stealth', amount: 1 }] },
    { stealthModifier: -1 }, { damageResistance: 1 }, { fearResistance: 1 },
    { consumable: true, recovery: { health: 1 } }, { damageMultiplier: 1 },
    { firearm: { ammunitionId: 'ammo' } }, { inventorySlots: 2 }]
  const items = [{ id: 'junk', quality: 1 }, { id: 'ammo', quality: 1, ammunition: true },
    ...effects.map((effect, index) => ({ id: `stat-${index}`, quality: 1, ...effect }))]
  for (const itemIds of ['all', items.map(item => item.id)]) {
    for (const restock of [undefined, false]) {
      const [seed] = buildContainerSeeds({ ...data.containers,
        lootTables: { test: { minItems: 2, maxItems: 2, itemIds } },
        placements: [{ id: 'trash', type: 'trash', lootTable: 'test', restock }],
      }, items)
      assert.deepEqual(seed.loot.itemIds, ['junk', 'ammo'])
      assert.deepEqual(rollLoot(seed.loot, () => 0).map(stack => stack.itemId), ['junk', 'ammo'])
    }
  }
})

test('trash content validation rejects a loot table with only stat-bearing items', () => {
  const data = content()
  const trash = data.containers.placements.find(placement => placement.type === 'trash')
  trash.quality = 5
  data.containers.lootTables[trash.lootTable] = { minItems: 1, maxItems: 1, itemIds: ['bread'] }
  assert.throws(() => validateContent(data), /not enough eligible items/)
})

test('container quality caps generated item quality for every level and can reach the matching level', () => {
  const data = content()
  const items = Array.from({ length: 5 }, (_, index) => ({ id: `q${index + 1}`, rarity: 'common', quality: index + 1 }))
  const seed = quality => buildContainerSeeds({ ...data.containers,
    lootTables: { test: { minItems: 1, maxItems: 1, itemIds: 'all' } },
    placements: [{ id: 'test', locationId: 'factory', type: 'crate', space: 'outside', x: 100, lootTable: 'test', quality }],
  }, items)[0]
  for (let quality = 1; quality <= 5; quality++) {
    const container = seed(quality)
    assert.deepEqual(container.loot.itemIds, items.slice(0, quality).map(item => item.id))
    assert.equal(rollLoot(container.loot, () => 0.999999)[0].itemId, `q${quality}`)
    for (let roll = 0; roll < 20; roll++) assert.ok(rollLoot(container.loot, () => roll / 20).every(stack => items.find(item => item.id === stack.itemId).quality <= quality))
  }
})

test('quality inherits from the container type and rejects zero or negative authored overrides', () => {
  const data = content()
  const seed = buildContainerSeeds({ ...data.containers, placements: [{ id: 'test', type: 'toolbox', locationId: 'factory', space: 'outside', x: 100, lootTable: 'rarity-scavenge' }] }, data.items)[0]
  const rare = data.items.find(item => seed.loot.itemIds.includes(item.id) && item.rarity === 'rare')
  assert.equal(seed.loot.weights[rare.id], data.containers.rarityWeights.rare * data.containers.types.toolbox.quality ** 2)
  const lower = buildContainerSeeds({ ...data.containers, placements: [{ id: 'override', type: 'toolbox', quality: 1, locationId: 'factory', space: 'outside', x: 100, lootTable: 'rarity-scavenge' }] }, data.items)[0]
  assert.equal(lower.quality, 1)
  assert.ok(lower.loot.itemIds.every(id => data.items.find(item => item.id === id).quality === 1))
  for (const patch of [data => { data.containers.types.trash.quality = 0 }, data => { data.containers.placements[0].quality = -1 },
    data => { data.items[0].quality = 6 }, data => { data.items[0].quality = 1.5 }, data => { delete data.items[0].quality },
    data => { data.containers.types.trash.quality = 6 }, data => { data.containers.types.trash.quality = 2.5 },
    data => { data.rooms['house-21'].containers[0].quality = 0 }]) {
    const { data, sources } = catalogue(); patch(data)
    assert.throws(() => validateContent(data, sources), /quality/)
  }
})

test('real authored world and room containers never generate items above their quality', () => {
  const data = content()
  const placements = [...data.containers.placements, ...roomContainerPlacements(data.locations, data.buildings, data.rooms)]
  const seeds = buildContainerSeeds({ ...data.containers, placements }, data.items)
  for (const seed of seeds) for (const id of seed.loot?.itemIds ?? []) {
    assert.ok(data.items.find(item => item.id === id).quality <= seed.quality, `${seed.id}: ${id}`)
  }
  const bad = content()
  bad.containers.lootTables.scavenge.itemIds = ['service-pistol']
  bad.containers.placements.find(placement => placement.lootTable === 'scavenge').quality = 1
  assert.throws(() => validateContent(bad), /quality/)
})
