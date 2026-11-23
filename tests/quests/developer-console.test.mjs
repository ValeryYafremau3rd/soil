import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'

const data = content()
test('testing starts bypass prerequisites and NPC offers, reject duplicate/unknown starts', () => {
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const quests = new QuestService(data.quests, inventory)
  const locked = data.quests.find(quest => quest.prerequisites?.length && quest.offeredBy)
  assert.ok(locked)
  assert.equal(quests.acceptFromNpc(locked.id, locked.offeredBy), false)
  assert.equal(quests.startForTesting(locked.id), true)
  assert.equal(quests.isActive(locked.id), true)
  const snapshot = quests.getSnapshot()
  assert.equal(quests.startForTesting(locked.id), false)
  assert.equal(quests.startForTesting('unknown'), false)
  assert.equal(quests.getSnapshot(), snapshot)
})

test('testing acceptance ignores payment and full starter-item capacity', () => {
  const inventory = new InventoryService(data.items, [], () => 0, [])
  inventory.grantItems(Array.from({ length: 6 }, () => ({ itemId: 'rope', quantity: 1 })))
  const definition = { id: 'testing', name: 'Testing', description: '', prerequisites: ['missing'], stages: [
    { id: 'accept', description: '', trigger: { kind: 'accept' }, removeItems: [{ itemId: 'money', quantity: 100 }], grantItems: [{ itemId: 'rope', quantity: 1 }] },
    { id: 'pending', description: '', trigger: { kind: 'pending' } },
  ] }
  const quests = new QuestService([definition], inventory)
  const before = inventory.getSnapshot()
  assert.equal(quests.startForTesting('testing'), true)
  assert.equal(quests.isActive('testing'), true)
  assert.equal(quests.getSnapshot().progress[0].stageIndex, 1)
  assert.equal(inventory.getSnapshot(), before)
})
