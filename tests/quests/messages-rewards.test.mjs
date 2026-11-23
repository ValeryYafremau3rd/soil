import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { strapQuestCatalogue } from '../helpers/strapQuest.mjs'
import { MessageService } from '../../src/app/services/ui/MessageService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'

test('shared messages retain repeated notifications as separate entries and dismiss by ID', () => {
  const messages = new MessageService()
  messages.show('No free room in inventory.')
  messages.show('No free room in inventory.')
  messages.show('Quest added.')
  const queued = messages.getSnapshot().messages
  assert.equal(queued.length, 3)
  assert.equal(new Set(queued.map(message => message.id)).size, 3)
  messages.dismiss(queued[0].id)
  assert.deepEqual(messages.getSnapshot().messages, queued.slice(1))
  const before = messages.getSnapshot()
  messages.dismiss(999)
  messages.show('  ')
  assert.equal(messages.getSnapshot(), before)
})

test('every full-inventory pickup and take-all attempt notifies, while partial stacks can still accept items', () => {
  const messages = new MessageService()
  const inventory = new InventoryService(content().items, [{ id: 'box', name: 'Box', locationId: 'test', items: [{ itemId: 'pistol-ammunition', quantity: 2 }] }],
    () => 0, [{ itemId: 'pistol-ammunition', quantity: 4 }, { itemId: 'work-pass', quantity: 5 }], undefined, undefined, undefined, messages.show)
  inventory.openContainer('box')
  inventory.takeItem('pistol-ammunition', 0)
  assert.equal(inventory.getSnapshot().items[0].quantity, 5)
  assert.equal(messages.getSnapshot().messages.length, 0)
  const before = inventory.getSnapshot()
  inventory.takeItem('pistol-ammunition', 0)
  inventory.takeItem('pistol-ammunition', 0)
  inventory.takeAll()
  inventory.takeAll()
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(messages.getSnapshot().messages.length, 4)
  assert.ok(messages.getSnapshot().messages.every(message => /No free room/.test(message.text)))
})

function turnInSetup(startingItems, reward) {
  const { data } = strapQuestCatalogue()
  const definition = data.quests[0]
  if (reward) definition.reward = reward
  const messages = new MessageService()
  const inventory = new InventoryService(data.items, [], () => 0, startingItems, undefined, undefined, undefined, messages.show)
  const quests = new QuestService([definition], inventory, messages.show)
  quests.openBoard()
  quests.accept(definition.id)
  quests.advanceDialogue(definition.id, 'bartender', 'delivery-notice')
  const deliver = () => quests.advanceDialogue(definition.id, 'bartender', 'deliver-rope')
  const stage = () => quests.getSnapshot().progress[0].stageIndex
  return { inventory, quests, messages, deliver, stage }
}

test('a reward that does not fit leaves turn-in items, money, and quest unchanged, and can be retried', () => {
  const { inventory, messages, deliver, stage } = turnInSetup([{ itemId: 'rope', quantity: 1 }, { itemId: 'work-pass', quantity: 5 }])
  const before = inventory.getSnapshot()
  assert.equal(stage(), 2)
  assert.equal(deliver(), false)
  assert.equal(deliver(), false)
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(stage(), 2)
  assert.equal(messages.getSnapshot().messages.filter(message => /No free room/.test(message.text)).length, 2)
  inventory.removeItems([{ itemId: 'work-pass', quantity: 1 }])
  assert.equal(deliver(), true)
  assert.equal(stage(), 3)
  assert.equal(inventory.getSnapshot().items.length, 6)
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'rope'), false)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'service-pistol').quantity, 1)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'pistol-ammunition').quantity, 5)
  const finished = inventory.getSnapshot()
  assert.equal(deliver(), false)
  assert.equal(inventory.getSnapshot(), finished)
  const notices = messages.getSnapshot().messages.map(message => message.text)
  assert.ok(notices.some(message => /Quest added/.test(message)))
  assert.ok(notices.some(message => / updated\.$/.test(message)))
  assert.equal(notices.filter(message => /Quest finished/.test(message)).length, 1)
})

test('reward quantity must fit completely including partial ammo stacks; no partial items or money are granted', () => {
  const reward = { items: [{ itemId: 'service-pistol', quantity: 1 }, { itemId: 'pistol-ammunition', quantity: 5 }], money: 8 }
  const { inventory, deliver } = turnInSetup([{ itemId: 'rope', quantity: 1 }, { itemId: 'work-pass', quantity: 4 }, { itemId: 'pistol-ammunition', quantity: 4 }], reward)
  const before = inventory.getSnapshot()
  assert.equal(deliver(), false)
  assert.equal(inventory.getSnapshot(), before)
  inventory.removeItems([{ itemId: 'work-pass', quantity: 2 }])
  assert.equal(deliver(), true)
  assert.equal(inventory.getSnapshot().money, 8)
  assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId === 'pistol-ammunition').map(item => item.quantity), [5, 4])
})

test('money-only reward works with a full inventory and is paid once', () => {
  const { inventory, deliver } = turnInSetup([{ itemId: 'rope', quantity: 1 }, { itemId: 'work-pass', quantity: 5 }], { money: 7 })
  assert.equal(deliver(), true)
  assert.equal(inventory.getSnapshot().money, 7)
  assert.equal(deliver(), false)
  assert.equal(inventory.getSnapshot().money, 7)
})
