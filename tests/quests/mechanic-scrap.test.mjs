import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

const id = 'mechanic-scrap'
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
  const talk = () => dialogue.openDialogue('Irina', data.dialogues['worker'], 'worker')
  const deliver = () => quests.advanceDialogue(id, 'worker', 'deliver-scrap')
  const progress = () => quests.getSnapshot().progress.find(q => q.questId === id)
  return { inventory, quests, dialogue, talk, deliver, progress }
}

test('Irina scrap request supports declining, collection, restored progress and one payment', () => {
  const { inventory, quests, dialogue, talk, deliver, progress } = setup()
  assert.equal(quests.canOffer(id, 'citizen-mechanic'), false)
  assert.equal(quests.acceptFromNpc(id, 'citizen-mechanic'), false)
  assert.equal(quests.canOffer(id, 'worker'), true)
  talk()
  dialogue.chooseReply('ask-about-materials')
  dialogue.chooseReply('back')
  assert.equal(progress(), undefined)
  dialogue.chooseReply('ask-about-materials')
  dialogue.chooseReply('accept-scrap')
  assert.equal(progress().stageIndex, 0)
  assert.equal(quests.getBoardQuests().some(q => q.id === id), false)
  inventory.grantItems([stack('cloth')])
  assert.equal(progress().stageIndex, 0)
  inventory.grantItems([stack('copper-wire')])
  assert.equal(progress().stageIndex, 1)
  quests.restoreState(quests.getSnapshot().progress)
  inventory.removeItems([stack('copper-wire')])
  assert.equal(deliver(), false)
  inventory.grantItems([stack('bent-nails')])
  assert.equal(quests.advanceDialogue(id, 'citizen-mechanic', 'deliver-scrap'), false)
  talk()
  dialogue.chooseReply('deliver-scrap')
  assert.equal(quests.isCompleted(id), true)
  assert.equal(inventory.getSnapshot().items.some(s => s.itemId === 'bent-nails'), false)
  assert.equal(inventory.getSnapshot().items.find(s => s.itemId === 'money')?.quantity, 10)
  assert.ok(inventory.getSnapshot().items.some(s => s.itemId === 'work-gloves') || inventory.getSnapshot().equipment.accessory === 'work-gloves')
  assert.equal(deliver(), false)
  assert.equal(quests.acceptFromNpc(id, 'worker'), false)
})

test('carried scrap counts and a full inventory preserves hand-in until reward space is available', () => {
  const { inventory, quests, deliver, progress } = setup([
    stack('copper-wire'), stack('rope'), stack('matchbox'), stack('chemistry-erudition'),
    stack('red-cigarettes'), stack('cloth'),
  ])
  assert.equal(quests.acceptFromNpc(id, 'worker'), true)
  assert.equal(progress().stageIndex, 1)
  const before = inventory.getSnapshot()
  assert.equal(deliver(), false)
  assert.equal(inventory.getSnapshot(), before)
  inventory.removeItems([stack('rope'), stack('matchbox')])
  assert.equal(deliver(), true)
})
