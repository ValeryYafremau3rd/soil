import test from 'node:test'
import assert from 'node:assert/strict'
import { strapQuestCatalogue as catalogue } from '../helpers/strapQuest.mjs'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { MessageService } from '../../src/app/services/ui/MessageService.ts'

const questId = 'a-fraying-strap'

test('retired strap quest and its dialogue are absent from playable content', () => {
  const data = content()
  assert.equal(data.quests.some(quest => quest.id === questId), false)
  const nodes = data.dialogues.bartender.nodes
  assert.equal(nodes['delivery-request'], undefined)
  assert.equal(nodes['delivery-thanks'], undefined)
  assert.equal(Object.values(nodes).some(node =>
    node.choices.some(choice => choice.questId === questId)), false)
})
function setup(startingItems = []) {
  const { data } = catalogue()
  const messages = new MessageService()
  const inventory = new InventoryService(data.items, [], () => 0, startingItems, undefined, undefined, undefined, messages.show)
  const quests = new QuestService(data.quests, inventory, messages.show)
  const dialogue = new DialogueService(() => {}, {
    canChoose: (npcId, choice) => quests.canAdvanceDialogue(choice.questId, npcId, choice.id),
    choose: (npcId, choice) => quests.advanceDialogue(choice.questId, npcId, choice.id),
  })
  const talk = (npcId = 'bartender') => dialogue.openDialogue('Bartender', data.dialogues.bartender, npcId)
  const stage = () => quests.getSnapshot().progress.find(entry => entry.questId === questId)?.stageIndex
  const rope = () => inventory.getSnapshot().items.reduce((total, item) => total + (item.itemId === 'rope' ? item.quantity : 0), 0)
  return { data, inventory, quests, dialogue, talk, stage, rope, messages }
}

test('quest is accepted only from an open board, once, and persists across board visits', () => {
  const { quests, stage } = setup()
  quests.accept(questId)
  assert.equal(stage(), undefined)
  quests.openBoard()
  quests.accept('missing')
  assert.equal(stage(), undefined)
  quests.accept(questId)
  assert.equal(stage(), 0)
  assert.equal(quests.getSnapshot().boardOpen, false)
  quests.openBoard()
  quests.accept(questId)
  assert.equal(quests.getSnapshot().progress.length, 1)
  quests.closeBoard()
  assert.equal(stage(), 0)
})

test('configured quest runs board → correct NPC reply → inventory item → delivery, removing exactly one item', () => {
  const { quests, inventory, dialogue, talk, stage, rope } = setup()
  talk()
  assert.equal(dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'delivery-notice'), false)
  dialogue.chooseReply('delivery-notice')
  assert.equal(stage(), undefined)
  dialogue.closeDialogue()
  quests.openBoard()
  quests.accept(questId)
  talk('cashier')
  assert.equal(dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'delivery-notice'), false)
  assert.equal(quests.advanceDialogue(questId, 'cashier', 'delivery-notice'), false)
  talk()
  dialogue.closeDialogue()
  assert.equal(stage(), 0, 'cancelled conversation does not advance')
  talk()
  dialogue.chooseReply('delivery-notice')
  assert.equal(stage(), 1)
  assert.equal(quests.advanceDialogue(questId, 'bartender', 'delivery-notice'), false)
  inventory.grantItems([{ itemId: 'bread', quantity: 1 }])
  assert.equal(stage(), 1)
  inventory.grantItems([{ itemId: 'rope', quantity: 2 }])
  assert.equal(stage(), 2)
  talk()
  assert.equal(dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'deliver-rope'), true)
  dialogue.chooseReply('deliver-rope')
  assert.equal(stage(), 3)
  assert.equal(rope(), 1)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'service-pistol').quantity, 1)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'pistol-ammunition').quantity, 5)
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'bread'))
  dialogue.chooseReply('deliver-rope')
  talk()
  dialogue.chooseReply('deliver-rope')
  assert.equal(rope(), 1, 'repeated delivery cannot remove another item')
  assert.equal(dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'deliver-rope'), false)
  quests.openBoard()
  quests.accept(questId)
  assert.equal(stage(), 3)
})

test('already-carried requirements count, and delivery rechecks inventory after a collected item is lost', () => {
  const { quests, inventory, dialogue, talk, stage } = setup([{ itemId: 'rope', quantity: 1 }])
  quests.openBoard()
  quests.accept(questId)
  assert.equal(stage(), 0)
  talk()
  dialogue.chooseReply('delivery-notice')
  assert.equal(stage(), 2)
  talk()
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }])
  dialogue.chooseReply('deliver-rope')
  assert.equal(stage(), 2, 'stale visible reply still rechecks requirements')
  talk()
  assert.equal(dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'deliver-rope'), false)
  inventory.grantItems([{ itemId: 'rope', quantity: 1 }])
  talk()
  dialogue.chooseReply('deliver-rope')
  assert.equal(stage(), 3)
})

test('quest item removal is atomic, aggregates requirements and handles quantities across slots', () => {
  const { inventory } = setup([{ itemId: 'bandage', quantity: 7 }, { itemId: 'rope', quantity: 1 }])
  const before = inventory.getSnapshot()
  assert.equal(inventory.removeItems([{ itemId: 'bandage', quantity: 3 }, { itemId: 'rope', quantity: 2 }]), false)
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(inventory.removeItems([{ itemId: 'bandage', quantity: 2 }, { itemId: 'bandage', quantity: 4 }]), true)
  assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId === 'bandage'), [{ itemId: 'bandage', quantity: 1 }])
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'rope').quantity, 1)
  assert.equal(inventory.removeItems([{ itemId: 'rope', quantity: -1 }]), false)
})

test('authored quests validate NPC, dialogue choice, item references and inventory-stage requirements', () => {
  const valid = catalogue()
  validateContent(valid.data, valid.sources)
  for (const patch of [
    quest => { quest.stages[0].trigger.npcId = 'missing' },
    quest => { quest.stages[0].trigger.choiceId = 'missing' },
    quest => { quest.stages[1].requiredItems[0].itemId = 'missing' },
    quest => { delete quest.stages[1].requiredItems },
    quest => { quest.stages[2].removeItems[0].quantity = 0 },
    quest => { quest.stages[1].id = quest.stages[0].id },
    quest => { quest.reward.items[0].itemId = 'missing' },
    quest => { quest.reward.money = -1 },
    quest => { quest.reward = {} },
  ]) {
    const { data, sources } = catalogue()
    patch(data.quests[0])
    assert.throws(() => validateContent(data, sources), /src\/content\/uests\/a-fraying-strap.json/)
  }
})
