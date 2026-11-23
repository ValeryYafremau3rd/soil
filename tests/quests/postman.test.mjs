import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'

/** Create real postbox inventory and deterministic daily quest services. */
function setup(random = () => 0) {
  const data = content()
  const time = new DayTimeService()
  const inventory = new InventoryService(
    data.items, buildContainerSeeds(data.containers, data.items)
  )
  const quests = new QuestService(data.quests, inventory, undefined, time, random)
  quests.startInitialQuests()
  return { time, inventory, quests }
}

/** Count letters waiting inside the postbox. */
function letters(inventory) {
  return inventory.getSnapshot().containers['center-post'].items
    .filter(item => item.itemId === 'postman-letter')
    .reduce((count, item) => count + item.quantity, 0)
}

test('postbox creates one letter and unfinished postman work survives mornings and reloads', () => {
  let roll = 0
  const { time, inventory, quests } = setup(() => roll)
  assert.equal(letters(inventory), 1)
  assert.equal(quests.isActive('postman'), false)
  assert.equal(quests.getSnapshot().progress.some(entry => entry.questId === 'postman'), false)
  const route = quests.definitions.find(quest => quest.id === 'postman')
  roll = 0.999
  const waiting = structuredClone(quests.getSnapshot())
  quests.restoreState(waiting.progress, waiting.courierBoard, waiting.npcJobs)
  quests.startInitialQuests()
  assert.equal(quests.isActive('postman'), false)
  assert.equal(letters(inventory), 1)
  time.nextMorning()
  time.nextMorning()
  assert.equal(letters(inventory), 1)
  assert.equal(quests.isActive('postman'), false)
  assert.equal(quests.definitions.find(q => q.id === 'postman').name, route.name)
  inventory.openContainer('center-post')
  assert.equal(quests.isActive('postman'), false)
  assert.equal(quests.canTakeDeliveryItem('center-post', 'postman-letter'), true)
  inventory.takeItem('postman-letter')
  assert.equal(quests.isActive('postman'), true)
  assert.equal(letters(inventory), 0)
  const state = structuredClone(quests.getSnapshot())
  quests.restoreState(state.progress, state.courierBoard, state.npcJobs)
  quests.startInitialQuests()
  assert.equal(letters(inventory), 0)
  time.nextMorning()
  assert.equal(letters(inventory), 0)
  assert.equal(quests.advanceDialogue('postman', 'wrong-person', 'postman-deliver'), false)
  assert.equal(quests.advanceDialogue(
    'postman', route.stages[1].trigger.npcId, 'postman-deliver'
  ), true)
  assert.equal(quests.advanceDialogue(
    'postman', route.stages[1].trigger.npcId, 'postman-deliver'
  ), false)
  time.advance()
  assert.equal(letters(inventory), 0)
  const finished = structuredClone(quests.getSnapshot())
  quests.restoreState(finished.progress, finished.courierBoard, finished.npcJobs)
  quests.startInitialQuests()
  assert.equal(letters(inventory), 0)
  time.nextMorning()
  assert.equal(letters(inventory), 1)
  assert.equal(quests.isActive('postman'), false)
  quests.startInitialQuests()
  assert.equal(letters(inventory), 1)
})

test('cancelled or full-inventory postbox pickups do not start a quest', () => {
  const { inventory, quests } = setup()
  inventory.openContainer('center-post')
  inventory.closeMenu()
  assert.equal(quests.isActive('postman'), false)
  inventory.grantItems(['letter', 'postcard', 'cloth', 'rope', 'bandage', 'bread']
    .map(itemId => ({ itemId, quantity: 1 })))
  inventory.openContainer('center-post')
  inventory.takeItem('postman-letter')
  assert.equal(quests.isActive('postman'), false)
  assert.equal(letters(inventory), 1)
  inventory.removeItems([{ itemId: 'bread', quantity: 1 }])
  inventory.takeAll()
  assert.equal(quests.isActive('postman'), true)
  assert.equal(letters(inventory), 0)
})

test('legacy uncollected postman progress becomes a waiting letter on reload', () => {
  const { inventory, quests } = setup()
  const saved = structuredClone(quests.getSnapshot())
  const parameters = saved.courierBoard.parameters.postman
  saved.progress.push({ questId: 'postman', stageIndex: 0, parameters })
  saved.courierBoard.acceptedQuestIds.push('postman')
  quests.restoreState(saved.progress, saved.courierBoard, saved.npcJobs)
  quests.startInitialQuests()
  assert.equal(quests.isActive('postman'), false)
  assert.equal(quests.getSnapshot().progress.some(entry => entry.questId === 'postman'), false)
  inventory.openContainer('center-post')
  inventory.takeItem('postman-letter')
  assert.equal(quests.isActive('postman'), true)
  assert.deepEqual(quests.getSnapshot().progress.find(entry => entry.questId === 'postman')
    .parameters, parameters)
})
