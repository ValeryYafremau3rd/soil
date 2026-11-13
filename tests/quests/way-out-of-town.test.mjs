import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { availableBoardQuests } from '../../src/domain/quests/quests.ts'
import { rollCorpseLoot } from '../../src/domain/combat/patrolCombat.ts'

function setup(items = []) {
  const data = content()
  const inventory = new InventoryService(data.items, [], () => 0, items)
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  quests.visitLocation('center')
  const stage = () => quests.getSnapshot().progress.find(entry => entry.questId === 'way-out-of-town').stageIndex
  const addCorpse = () => inventory.addTemporaryContainer({ id: 'titan-corpse', name: 'Titan corpse', locationId: 'factory',
    items: rollCorpseLoot(data.patrols.types.titan.corpseLoot) })
  return { data, inventory, quests, stage, addCorpse }
}

test('starting quest appears once, stays off boards, and restores without resetting its stage', () => {
  const { data, inventory, quests, stage, addCorpse } = setup()
  assert.equal(stage(), 1)
  quests.startInitialQuests()
  assert.equal(quests.getSnapshot().progress.length, data.quests.filter(q => q.autoStart).length)
  assert.equal(availableBoardQuests(data.quests, [], quests.getSnapshot().courierBoard, 20).some(q => q.autoStart), false)
  addCorpse()
  inventory.openContainer('titan-corpse')
  assert.equal(stage(), 1, 'opening or cancelling a search does not collect the key')
  inventory.takeAll()
  assert.equal(stage(), 2)
  assert.equal(quests.isCompleted('way-out-of-town'), false)
  assert.deepEqual(inventory.getSnapshot().containers['titan-corpse'].items, [])
  inventory.takeAll()
  assert.equal(stage(), 2)
  const saved = structuredClone(quests.getSnapshot().progress)
  quests.restoreState(saved)
  quests.startInitialQuests()
  assert.equal(stage(), 2)
  assert.equal(quests.getSnapshot().progress.length, data.quests.filter(q => q.autoStart).length)
  assert.equal(inventory.getSnapshot().items.filter(item => item.itemId === 'strange-key').length, 1)
  quests.restoreState([])
  quests.startInitialQuests()
  quests.visitLocation('center')
  assert.equal(stage(), 2, 'older saves gain the quest and recognize an already acquired key')
})

test('full inventory leaves the key on the corpse until a successful pickup', () => {
  const { inventory, stage, addCorpse } = setup(Array.from({ length: 6 }, () => ({ itemId: 'rope', quantity: 1 })))
  addCorpse()
  inventory.openContainer('titan-corpse')
  inventory.takeAll()
  assert.equal(stage(), 1)
  assert.deepEqual(inventory.getSnapshot().containers['titan-corpse'].items, [{ itemId: 'strange-key', quantity: 1 }])
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }])
  inventory.takeAll()
  assert.equal(stage(), 2)
})

test('escape opening advances only on reaching Center, once, and keeps an early key', () => {
  const data = content()
  const inventory = new InventoryService(data.items, [], () => 0, [{ itemId: 'strange-key', quantity: 1 }])
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  const stage = () => quests.getSnapshot().progress.find(entry => entry.questId === 'way-out-of-town').stageIndex
  assert.equal(stage(), 0)
  quests.visitLocation('factory')
  quests.visitLocation('living-district')
  assert.equal(stage(), 0)
  quests.visitLocation('center')
  assert.equal(stage(), 2)
  quests.visitLocation('center')
  assert.equal(stage(), 2)
})

test('Center changes the opening objective to finding a way out', () => {
  const data = content()
  const inventory = new InventoryService(data.items, [])
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  quests.visitLocation('center')
  const progress = quests.getSnapshot().progress.find(entry => entry.questId === 'way-out-of-town')
  assert.equal(progress.stageIndex, 1)
  assert.equal(data.quests.find(entry => entry.id === progress.questId).stages[progress.stageIndex].description, 'Find a way out of the town.')
})
