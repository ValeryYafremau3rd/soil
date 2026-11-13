import test from 'node:test'
import assert from 'node:assert/strict'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'

function setup() {
  const data = content()
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  const progress = () => quests.getSnapshot().progress.find(q => q.questId === 'find-work')
  const ask = () => quests.advanceDialogue('find-work', 'citizen-clerk', 'find-work-ask')
  const report = () => quests.advanceDialogue('find-work', 'citizen-clerk', 'find-work-report')
  return { inventory, quests, progress, ask, report }
}

test('starting quests stay silent and updates contain only the quest name', () => {
  const data = content()
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const messages = []
  const quests = new QuestService(data.quests, inventory, text => messages.push(text))
  quests.startInitialQuests()
  quests.startInitialQuests()
  assert.deepEqual(messages, [])
  assert.equal(quests.advanceDialogue('find-work', 'citizen-clerk', 'find-work-ask'), true)
  assert.deepEqual(messages, [`${data.quests.find(q => q.id === 'find-work').name} updated.`])
})

for (const reverse of [false, true]) test(`work contacts count once in either order (${reverse}) and survive restoration`, () => {
  const { inventory, quests, progress, ask, report } = setup()
  assert.equal(report(), false)
  assert.equal(ask(), true)
  assert.equal(ask(), false)
  assert.equal(inventory.getSnapshot().items.filter(s => s.itemId === 'key-ring').length, 1)
  quests.visitRoom('living-district', 'apartments', 'apartment-22')
  const jobs = [['smuggler-1', 'citizen-mechanic'], ['bartender-supplies', 'bartender'], ['cashier-1', 'cashier'], ['nurse-tablet-deliveries', 'citizen-nurse']]
  if (reverse) jobs.reverse()
  for (const [id, npc] of jobs) {
    assert.equal(report(), false)
    assert.equal(quests.acceptFromNpc(id, npc), true)
    const saved = structuredClone(quests.getSnapshot().progress)
    assert.equal(quests.acceptFromNpc(id, npc), false)
    quests.restoreState(saved)
    assert.equal(progress().stageIndex, 1)
  }
  assert.equal(report(), false)
  quests.visitRoom('center', 'apartments', 'apartment-21')
  assert.equal(report(), false)
  quests.visitRoom('living-district', 'apartments', 'apartment-21')
  assert.equal(progress().stageIndex, 6)
  quests.restoreState(quests.getSnapshot().progress)
  quests.visitRoom('living-district', 'apartments', 'apartment-21')
  inventory.removeItems(inventory.getSnapshot().items)
  inventory.grantItems(Array.from({ length: 6 }, () => ({ itemId: 'rope', quantity: 1 })))
  assert.equal(report(), false)
  assert.equal(quests.isCompleted('find-work'), false)
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }])
  assert.equal(report(), true)
  assert.equal(report(), false)
  assert.equal(inventory.getSnapshot().items.filter(s => s.itemId === 'old-newspapers').length, 1)
})

test('room visit can come before jobs, and a full inventory blocks the clerk key handover atomically', () => {
  const { inventory, quests, progress, ask } = setup()
  quests.visitRoom('living-district', 'apartments', 'apartment-21')
  assert.equal(progress().stageIndex, 0)
  inventory.grantItems(Array.from({ length: 6 }, () => ({ itemId: 'rope', quantity: 1 })))
  assert.equal(ask(), false)
  assert.equal(progress().stageIndex, 0)
  assert.equal(inventory.getSnapshot().items.some(s => s.itemId === 'key-ring'), false)
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }])
  assert.equal(ask(), true)
  quests.visitRoom('living-district', 'apartments', 'apartment-21')
  assert.deepEqual(progress().completedStageIds, ['visit-apartment'])
  quests.restoreState(quests.getSnapshot().progress)
  assert.deepEqual(progress().completedStageIds, ['visit-apartment'])
  assert.equal(classes.every(c => !c.startingItems.includes('key-ring')), true)
})

test('work accepted before meeting the clerk is recognized, but cancelled or blocked acceptance is not', () => {
  const { quests, progress, ask } = setup()
  assert.equal(quests.acceptFromNpc('smuggler-1', 'bartender'), false)
  assert.equal(quests.acceptFromNpc('smuggler-1', 'citizen-mechanic'), true)
  assert.equal(progress().stageIndex, 0)
  assert.equal(ask(), true)
  assert.deepEqual(progress().completedStageIds, ['work-citizen-mechanic'])
})
