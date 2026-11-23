import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

const id = 'nurse-tablet-deliveries'
const stack = itemId => ({ itemId, quantity: 1 })
function setup(items = []) {
  const data = content()
  const inventory = new InventoryService(data.items, [], () => 0, items)
  const quests = new QuestService(data.quests, inventory)
  const dialogue = new DialogueService(() => {}, {
    canChoose: (npc, choice) => quests.canAdvanceDialogue(choice.questId, npc, choice.id),
    choose: (npc, choice) => quests.advanceDialogue(choice.questId, npc, choice.id),
    canOffer: quests.canOffer, acceptFromNpc: quests.acceptFromNpc,
  })
  const talk = npc => dialogue.openDialogue(npc, data.dialogues[npc], npc)
  const count = itemId => inventory.getSnapshot().items.filter(s => s.itemId === itemId).reduce((n, s) => n + s.quantity, 0)
  const visit = npc => quests.advanceDialogue(id, npc, npc === 'citizen-caretaker' ? 'nurse-tablet-deliver' : 'nurse-tablet-offer')
  const report = () => quests.advanceDialogue(id, 'citizen-nurse', 'nurse-tablet-report')
  return { inventory, quests, dialogue, talk, count, visit, report }
}

for (const order of [['citizen-caretaker', 'citizen-mechanic'], ['citizen-mechanic', 'citizen-caretaker']]) {
  test(`nurse deliveries track independent visits: ${order.join(' then ')}`, () => {
    const { inventory, quests, dialogue, talk, count, visit, report } = setup()
    assert.equal(visit(order[0]), false)
    talk('citizen-nurse')
    dialogue.chooseReply('ask-about-tablets')
    dialogue.chooseReply('back')
    assert.equal(count('white-tablets'), 0)
    dialogue.chooseReply('ask-about-tablets')
    dialogue.chooseReply('accept-tablets')
    assert.equal(count('white-tablets'), 2)
    assert.equal(quests.acceptFromNpc(id, 'citizen-nurse'), false)
    assert.equal(report(), false)
    assert.equal(visit(order[0]), true)
    assert.equal(count('white-tablets'), order[0] === 'citizen-caretaker' ? 1 : 2)
    quests.restoreState(quests.getSnapshot().progress)
    assert.equal(visit(order[0]), false)
    assert.equal(report(), false)
    assert.equal(visit(order[1]), true)
    assert.equal(count('white-tablets'), 1)
    assert.equal(quests.isCompleted(id), false)
    assert.equal(report(), true)
    assert.equal(quests.isCompleted(id), true)
    assert.equal(count('white-tablets'), 2)
    assert.equal(count('health-magazine-medicine'), 1)
    assert.equal(report(), false)
    assert.equal(visit(order[1]), false)
    assert.equal(inventory.getSnapshot().money, 0)
  })
}

test('nurse acceptance and reward preserve items when inventory is full; missing tablets block visits', () => {
  const fillers = ['rope', 'matchbox', 'chemistry-erudition', 'red-cigarettes', 'cloth', 'bread'].map(stack)
  const { inventory, quests, count, visit, report } = setup(fillers)
  assert.equal(quests.acceptFromNpc(id, 'citizen-nurse'), false)
  assert.equal(count('white-tablets'), 0)
  inventory.removeItems([stack('bread')])
  assert.equal(quests.acceptFromNpc(id, 'citizen-nurse'), true)
  inventory.removeItems([{ itemId: 'white-tablets', quantity: 2 }])
  assert.equal(visit('citizen-caretaker'), false)
  assert.equal(visit('citizen-mechanic'), false)
  inventory.grantItems([{ itemId: 'white-tablets', quantity: 2 }])
  assert.equal(visit('citizen-mechanic'), true)
  assert.equal(visit('citizen-caretaker'), true)
  const before = inventory.getSnapshot()
  assert.equal(report(), false)
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(quests.isCompleted(id), false)
  inventory.removeItems([stack('rope')])
  assert.equal(report(), true)
  assert.equal(count('white-tablets'), 2)
})
