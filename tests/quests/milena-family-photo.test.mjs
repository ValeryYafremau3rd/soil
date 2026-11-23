import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

test('Milena offers her keepsake quest and exchanges the collected photo once', () => {
  const data = content()
  const id = 'milena-family-photo'
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const quests = new QuestService(data.quests, inventory)
  const dialogue = new DialogueService(() => {}, {
    canChoose: (npc, choice) => quests.canAdvanceDialogue(choice.questId, npc, choice.id),
    choose: (npc, choice) => quests.advanceDialogue(choice.questId, npc, choice.id),
    canOffer: quests.canOffer, acceptFromNpc: quests.acceptFromNpc,
  })
  const progress = () => quests.getSnapshot().progress.find(q => q.questId === id)
  const deliver = () => quests.advanceDialogue(id, 'stranger', 'return-family-photo')
  dialogue.openDialogue('Milena', data.dialogues.stranger, 'stranger')
  const choices = () => dialogue.getSnapshot().conversation.choices.map(choice => choice.id)
  dialogue.chooseReply('lost-suitcase')
  assert.ok(choices().includes('accept-photo-quest'))
  assert.ok(choices().includes('back'))
  dialogue.chooseReply('back')
  dialogue.chooseReply('lost-suitcase'); dialogue.chooseReply('back')
  assert.equal(progress(), undefined)
  dialogue.chooseReply('lost-suitcase'); dialogue.chooseReply('accept-photo-quest')
  assert.equal(progress().stageIndex, 0)
  dialogue.openDialogue('Milena', data.dialogues.stranger, 'stranger')
  assert.equal(choices().includes('lost-suitcase'), false)
  dialogue.chooseReply('accept-photo-quest')
  assert.equal(quests.getSnapshot().progress.filter(q => q.questId === id).length, 1)
  assert.equal(deliver(), false)
  inventory.grantItems([{ itemId: id, quantity: 1 }])
  assert.equal(progress().stageIndex, 1)
  quests.restoreState(quests.getSnapshot().progress)
  inventory.removeItems([{ itemId: id, quantity: 1 }])
  assert.equal(deliver(), false)
  inventory.grantItems([{ itemId: id, quantity: 1 }])
  assert.equal(quests.advanceDialogue(id, 'cashier', 'return-family-photo'), false)
  dialogue.openDialogue('Milena', data.dialogues.stranger, 'stranger')
  dialogue.chooseReply('return-family-photo')
  assert.equal(quests.isCompleted(id), true)
  assert.equal(inventory.getSnapshot().items.some(s => s.itemId === id), false)
  assert.equal(inventory.getSnapshot().items.find(s => s.itemId === 'sport-magazine-athletics')?.quantity, 1)
  assert.equal(deliver(), false)
  assert.equal(quests.acceptFromNpc(id, 'stranger'), false)
  const suitcase = data.containers.placements.find(c => c.id === 'milena-bus-stop-suitcase')
  assert.equal(suitcase.restock, false)
  assert.deepEqual(suitcase.items.map(s => [s.itemId, s.quantity]), [
    [id, 1], ['wool-socks', 1], ['chemistry-erudition', 1], ['white-tablets', 1], ['money', 8], ['bread', 1],
  ])
  assert.equal(data.items.find(i => i.id === id).saleable, false)
  assert.equal(data.items.find(i => i.id === id).randomLoot, false)
})

