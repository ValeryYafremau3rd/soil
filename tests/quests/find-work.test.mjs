import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
const data = content()
function setup() {
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  return { inventory, quests }
}
const ask = quests => quests.advanceDialogue('find-work', 'citizen-clerk', 'find-work-ask')
const report = quests => quests.advanceDialogue('find-work', 'citizen-clerk', 'find-work-report')
const jobs = [['smuggler-1', 'citizen-mechanic'], ['bartender-supplies', 'bartender'], ['cashier-1', 'cashier'], ['nurse-tablet-deliveries', 'citizen-nurse']]

test('the first work objective explains orientation and Pavel offers its reply after completion', () => {
  const { quests } = setup()
  const dialogue = new DialogueService(undefined, {
    canChoose: (npcId, reply) => quests.canAdvanceDialogue(reply.questId, npcId, reply.id),
    choose: (npcId, reply) => quests.advanceDialogue(reply.questId, npcId, reply.id),
    isCompleted: quests.isCompleted,
  })
  const open = () => dialogue.openDialogue('Pavel', data.dialogues['citizen-clerk'], 'citizen-clerk')
  assert.equal(quests.isCompleted('first-steps'), false)
  open()
  assert.equal(dialogue.getSnapshot().conversation.choices.some(reply => reply.id === 'find-work-ask'), false)
  assert.match(data.quests.find(q => q.id === 'find-work').stages[0].description, /Complete First Steps/)
  quests.restoreState(quests.getSnapshot().progress.map(run => run.questId === 'first-steps'
    ? { ...run, stageIndex: data.quests.find(q => q.id === 'first-steps').stages.length } : run))
  open()
  assert.ok(dialogue.getSnapshot().conversation.choices.some(reply => reply.id === 'find-work-ask'))
  dialogue.chooseReply('find-work-ask')
  const progress = quests.getSnapshot().progress.find(run => run.questId === 'find-work')
  assert.equal(progress.stageIndex, 1)
  open()
  assert.equal(dialogue.getSnapshot().conversation.choices.some(reply => reply.id === 'find-work-ask'), false)
  dialogue.chooseReply('find-work-ask')
  assert.equal(quests.getSnapshot().progress.find(run => run.questId === 'find-work'), progress)
})

test('starting quests stay silent and updates contain only the quest name', () => {
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const messages = []
  const quests = new QuestService(data.quests, inventory, text => messages.push(text))
  quests.startInitialQuests()
  quests.startInitialQuests()
  assert.deepEqual(messages, [])
  assert.equal(ask(quests), true)
  assert.deepEqual(messages, [`${data.quests.find(q => q.id === 'find-work').name} updated.`])
})
for (const reverse of [false, true]) test(`work needs four contacts, no apartment; restores and rewards once (${reverse})`, () => {
  const { inventory, quests } = setup()
  assert.equal(report(quests), false)
  assert.equal(ask(quests), true)
  assert.equal(ask(quests), false)
  assert.equal(inventory.getSnapshot().items.some(i => i.itemId === 'key-ring'), false)
  for (const [id, npc] of reverse ? [...jobs].reverse() : jobs) {
    assert.equal(report(quests), false)
    assert.equal(quests.acceptFromNpc(id, npc), true)
    assert.equal(quests.acceptFromNpc(id, npc), false)
    quests.restoreState(quests.getSnapshot().progress)
  }
  inventory.removeItems(inventory.getSnapshot().items)
  inventory.grantItems(Array.from({ length: 6 }, () => ({ itemId: 'rope', quantity: 1 })))
  assert.equal(report(quests), false)
  assert.equal(quests.isCompleted('find-work'), false)
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }])
  assert.equal(report(quests), true)
  assert.equal(report(quests), false)
  assert.equal(inventory.getSnapshot().items.filter(i => i.itemId === 'psychology-barter').length, 1)
})
test('work accepted before meeting the clerk counts; wrong NPC acceptance does not', () => {
  const { quests } = setup()
  assert.equal(quests.acceptFromNpc('smuggler-1', 'bartender'), false)
  assert.equal(quests.acceptFromNpc('smuggler-1', 'citizen-mechanic'), true)
  assert.equal(ask(quests), true)
  assert.deepEqual(quests.getSnapshot().progress.find(q => q.questId === 'find-work').completedStageIds, ['work-citizen-mechanic'])
})
