import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { migrateMotherJournal } from '../../src/app/persistence/migrateMotherJournal.ts'

test('mother journal follows the letter, Kovalenko gives directions, and rooftop loot stays readable', () => {
  const data = content(), id = 'milena-mother-journal'
  const roof = data.containers.placements.find(c => c.id === 'factory-roof-safe')
  const inventory = new InventoryService(data.items,
    buildContainerSeeds({ ...data.containers, placements: [roof] }, data.items), () => 0, [])
  const quests = new QuestService(data.quests, inventory)
  const dialogue = new DialogueService(() => {}, {
    canChoose: (npc, choice) => quests.canAdvanceDialogue(choice.questId, npc, choice.id),
    choose: (npc, choice) => quests.advanceDialogue(choice.questId, npc, choice.id),
    isCompleted: quests.isCompleted, canOffer: quests.canOffer, acceptFromNpc: quests.acceptFromNpc,
  })
  assert.equal(quests.acceptFromNpc(id, 'stranger'), false)
  const letter = data.quests.find(q => q.id === 'milena-mother-letter')
  quests.restoreState([
    { questId: letter.id, stageIndex: letter.stages.length },
    { questId: 'nurse-tablet-deliveries', stageIndex: data.quests.find(q => q.id === 'nurse-tablet-deliveries').stages.length },
  ])
  dialogue.openDialogue('Milena', data.dialogues.stranger, 'stranger')
  dialogue.chooseReply('mother-factory')
  dialogue.chooseReply('back')
  assert.equal(quests.getSnapshot().progress.some(q => q.questId === id), false)
  dialogue.chooseReply('mother-factory')
  dialogue.chooseReply('accept-mother-journal')
  assert.equal(quests.acceptFromNpc(id, 'stranger'), false)
  assert.equal(quests.advanceDialogue(id, 'stranger', 'ask-mother-belongings'), false)
  dialogue.openDialogue('Irina', data.dialogues.worker, 'worker')
  dialogue.chooseReply('ask-mother-belongings')
  assert.match(dialogue.getSnapshot().conversation.text, /soldiers have blocked the door/)
  assert.equal(quests.isCompleted(id), false)
  assert.equal(quests.advanceDialogue(id, 'worker', 'ask-mother-belongings'), false)
  inventory.openContainer(roof.id)
  inventory.takeAll()
  assert.equal(quests.isCompleted(id), true)
  inventory.openInventory()
  const index = inventory.getSnapshot().items.findIndex(i => i.itemId === id)
  inventory.useItem(index)
  assert.equal(inventory.getSnapshot().menu?.kind, 'reading')
  assert.match(inventory.getSnapshot().menu.text, /militia came to my home with two doctors/)
  assert.ok(inventory.getSnapshot().items.some(i => i.itemId === id))
  inventory.refreshContainers('morning')
  assert.equal(inventory.getSnapshot().containers[roof.id].items.some(i => i.itemId === id), false)
  assert.equal(data.items.find(i => i.id === id).saleable, false)
  assert.equal(data.items.find(i => i.id === id).randomLoot, false)
})

test('a journal found early still requires Kovalenko before the quest completes', () => {
  const data = content(), id = 'milena-mother-journal'
  const inventory = new InventoryService(data.items, [], () => 0, [{ itemId: id, quantity: 1 }])
  const quests = new QuestService(data.quests, inventory)
  const letter = data.quests.find(q => q.id === 'milena-mother-letter')
  quests.restoreState([
    { questId: letter.id, stageIndex: letter.stages.length },
    { questId: 'nurse-tablet-deliveries', stageIndex: data.quests.find(q => q.id === 'nurse-tablet-deliveries').stages.length },
  ])
  assert.equal(quests.acceptFromNpc(id, 'stranger'), true)
  assert.equal(quests.isCompleted(id), false)
  assert.equal(quests.advanceDialogue(id, 'worker', 'ask-mother-belongings'), true)
  assert.equal(quests.isCompleted(id), true)
  assert.ok(inventory.getSnapshot().items.some(i => i.itemId === id))
})

test('older saves receive the journal once while keeping rooftop loot and deposits', () => {
  const data = content(), id = 'milena-mother-journal', roofId = 'factory-roof-safe'
  const inventory = new InventoryService(data.items, buildContainerSeeds(data.containers, data.items), () => 0, [])
  const saved = inventory.saveState()
  delete saved.motherJournalVersion
  saved.containers[roofId].items = [{ itemId: 'bread', quantity: 1 }]
  saved.deposits[roofId] = [{ itemId: 'bread', quantity: 1 }]
  const migrated = migrateMotherJournal(saved)
  assert.deepEqual(migrated.containers[roofId].items, [
    { itemId: 'bread', quantity: 1 }, { itemId: id, quantity: 1 },
  ])
  assert.deepEqual(migrated.deposits, saved.deposits)
  assert.deepEqual(migrateMotherJournal(migrated), migrated)
  inventory.restoreState(saved)
  inventory.openContainer(roofId)
  inventory.takeAll()
  const collected = inventory.saveState()
  inventory.restoreState(collected)
  assert.equal(inventory.getSnapshot().containers[roofId].items.some(item => item.itemId === id), false)
  assert.equal(inventory.getSnapshot().items.filter(item => item.itemId === id).length, 1)
  delete collected.motherJournalVersion
  assert.equal(migrateMotherJournal(collected).containers[roofId].items.some(item => item.itemId === id), false)
})
