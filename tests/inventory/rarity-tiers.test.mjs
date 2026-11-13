import assert from 'node:assert/strict'
import test from 'node:test'
import { ITEM_RARITIES } from '../../src/domain/inventory/items.ts'
import { inventoryAppearance } from '../../src/ui/inventory/rarity.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue } from '../helpers/content.mjs'

test('all five tiers are authored, weighted, and supported by locks and rewards', () => {
  const { data, sources } = catalogue()
  validateContent(data, sources)
  assert.deepEqual(ITEM_RARITIES, ['common', 'uncommon', 'rare', 'epic', 'legendary'])
  for (const rarity of ITEM_RARITIES) {
    assert.ok(data.items.some(item => item.rarity === rarity), rarity)
    assert.ok(data.containers.rarityWeights[rarity] > 0, rarity)
    assert.ok(data.skills.scrapping.rarityWeights[rarity] > 0, rarity)
    assert.ok(data.skills.lockpickingMaxSumByRarity[rarity] <= 27, rarity)
    assert.ok(data.daytime.findItemRewardMultipliers[rarity] >= 1.5, rarity)
  }
  const seed = buildContainerSeeds({ ...data.containers,
    lootTables: { ...data.containers.lootTables, 'rarity-scavenge': { ...data.containers.lootTables['rarity-scavenge'], itemIds: 'all' } }, placements: [
    { id: 'test', locationId: 'factory', type: 'locker', space: 'outside', x: 100, quality: 5, lootTable: 'rarity-scavenge' },
  ] }, data.items)[0]
  for (const item of data.items.filter(item => ['epic', 'legendary'].includes(item.rarity))) assert.ok(seed.loot.weights[item.id] > 0, item.id)
})

test('only known carried buffs receive tier colors; sale-only valuables are gold and consumables stay neutral', () => {
  const { data } = catalogue()
  const items = Object.fromEntries(data.items.map(item => [item.id, item]))
  assert.equal(inventoryAppearance(items['service-pistol'], false), 'unknown')
  assert.equal(inventoryAppearance(items['service-pistol'], true), 'legendary')
  assert.equal(inventoryAppearance(items['medical-case'], true), 'plain')
  assert.equal(inventoryAppearance(items['white-tablets'], true), 'plain')
  assert.equal(inventoryAppearance(items['metal-bars'], true), 'plain')
  assert.equal(inventoryAppearance(items.postcard, true), 'valuable')
  assert.equal(inventoryAppearance(items.postcard, false), 'unknown')
  assert.equal(inventoryAppearance(items['key-ring'], true), 'plain')
})
