import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateRetiredQuests } from '../../src/app/persistence/migrateRetiredQuests.ts'

test('retired strap migration preserves other progress and inventory across repeated loads', () => {
  for (const stageIndex of [0, 1, 2, 3]) {
    const other = { questId: 'way-out-of-town', stageIndex: 1 }
    const inventory = { items: [{ itemId: 'service-pistol', quantity: 1 }], money: 10 }
    const save = {
      quests: [other, { questId: 'a-fraying-strap', stageIndex }],
      inventory,
    }
    migrateRetiredQuests(save)
    migrateRetiredQuests(save)
    assert.deepEqual(save.quests, [other])
    assert.equal(save.quests[0], other)
    assert.equal(save.inventory, inventory)
  }
})
