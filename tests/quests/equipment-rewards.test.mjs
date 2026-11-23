import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'

const rewards = {
  'cashier-1': 'leather-belt',
  'cashier-5': 'leather-boots',
  'factory-supplies': 'work-jacket',
  'milena-mother-journal': 'sun-amulet',
  'smuggler-4': 'precision-screwdriver',
  'way-out-of-town': 'compass',
  'well-trained': 'medal',
}

test('previously itemless story quests award existing equippable gear', () => {
  const data = content()
  for (const [id, itemId] of Object.entries(rewards)) {
    const quest = data.quests.find(entry => entry.id === id)
    assert.ok(!quest.repeatable, id)
    assert.deepEqual(quest.reward.items, [{ itemId, quantity: 1 }])
    assert.ok(data.items.find(item => item.id === itemId)?.equipmentSlot, itemId)
  }
  for (const quest of data.quests.filter(entry => entry.repeatable)) {
    assert.equal(quest.reward?.items, undefined, quest.id)
  }
})

test('training equipment blocks completion when full and awards once after retry', () => {
  const data = content()
  const items = Array.from({ length: 6 }, () => ({ itemId: 'rope', quantity: 1 }))
  const inventory = new InventoryService(data.items, [], () => 0, items)
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  quests.recordAction('workAsked')
  quests.recordAction('gunDefeat')
  quests.recordAction('meleeDefeat')
  quests.recordAction('objectHidden')
  assert.equal(quests.isCompleted('well-trained'), false)
  assert.ok(!inventory.getSnapshot().items.some(item => item.itemId === 'medal'))
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }])
  quests.recordAction('objectHidden')
  assert.equal(quests.isCompleted('well-trained'), true)
  quests.recordAction('objectHidden')
  assert.equal(inventory.getSnapshot().items.filter(item => item.itemId === 'medal').length, 1)
})
