import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { roomContainerPlacements } from '../../src/app/content/roomContainerPlacements.ts'

test('mother safe needs its key, letter stays after reading, and quest pays exactly once', () => {
  const data = content(), id = 'milena-mother-letter'
  const placements = roomContainerPlacements(data.locations, data.buildings, data.rooms)
  const safe = placements.find(p => p.id.endsWith(':mother-safe'))
  const seeds = buildContainerSeeds({ ...data.containers, placements: [safe] }, data.items)
  let picks = 0
  const inventory = new InventoryService(data.items, seeds, () => 0, [], undefined, undefined, () => { picks++ })
  const quests = new QuestService(data.quests, inventory, undefined, undefined, undefined, undefined, undefined, () => ({ barter: 20 }))
  assert.equal(quests.acceptFromNpc(id, 'stranger'), false)
  inventory.openContainer(safe.id)
  assert.equal(inventory.getSnapshot().menu, null)
  assert.equal(picks, 0)
  quests.startInitialQuests()
  const first = data.quests.find(q => q.id === 'first-steps')
  quests.restoreState(quests.getSnapshot().progress.map(q => q.questId === first.id ? { ...q, stageIndex: first.stages.length } : q))
  assert.equal(quests.acceptFromNpc(id, 'stranger'), true)
  assert.equal(quests.acceptFromNpc(id, 'stranger'), false)
  inventory.openContainer(safe.id)
  assert.equal(inventory.getSnapshot().menu?.containerId, safe.id)
  inventory.takeAll()
  inventory.openInventory()
  inventory.useItem(inventory.getSnapshot().items.findIndex(i => i.itemId === id))
  assert.equal(inventory.getSnapshot().menu?.kind, 'reading')
  assert.match(inventory.getSnapshot().menu.text, /hear voices/)
  assert.ok(inventory.getSnapshot().items.some(i => i.itemId === id))
  const finish = () => quests.advanceDialogue(id, 'stranger', 'return-mother-letter')
  assert.equal(finish(), true)
  assert.equal(finish(), false)
  assert.equal(inventory.getSnapshot().money, 20)
  assert.ok(inventory.getSnapshot().items.some(i => i.itemId === 'romance-book'))
  assert.ok(!inventory.getSnapshot().items.some(i => i.itemId === id))
  assert.equal(inventory.getSnapshot().items.find(i => i.itemId === 'pistol-ammunition').quantity, 6)
  assert.equal(data.items.find(i => i.id === 'old-pistol').skillRequirements.weapons, 6)
  inventory.refreshContainers('morning')
  assert.deepEqual(inventory.getSnapshot().containers[safe.id].items, [])
})

test('weapons follow-up is gated and visited replies stay marked across conversations', () => {
  const data = content()
  let skill = 1
  const dialogue = new DialogueService(() => {}, {
    canChoose: () => false, choose: () => false, isCompleted: () => true,
    canOffer: () => false, skill: () => skill,
  })
  const open = () => dialogue.openDialogue('Milena', data.dialogues.stranger, 'stranger')
  open()
  assert.match(dialogue.getSnapshot().conversation.choices.find(c => c.id === 'mother-safe-weapon').text, /Weapons 1\/2/)
  dialogue.chooseReply('mother-safe-weapon')
  assert.equal(dialogue.getSnapshot().conversation.text, data.dialogues.stranger.nodes.greeting.text)
  skill = 2
  open(); dialogue.chooseReply('mother-safe-weapon')
  assert.match(dialogue.getSnapshot().conversation.text, /Do not tell anyone/)
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.choices.find(c => c.id === 'mother-safe-weapon').visited, true)
  dialogue.closeDialogue(); open()
  assert.equal(dialogue.getSnapshot().conversation.choices.find(c => c.id === 'mother-safe-weapon').visited, true)
})

test('full inventory rejects the safe key without accepting the quest', () => {
  const data = content(), id = 'milena-mother-letter'
  const inventory = new InventoryService(data.items, [], () => 0,
    Array.from({ length: 6 }, () => ({ itemId: 'rope', quantity: 1 })))
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  const first = data.quests.find(q => q.id === 'first-steps')
  quests.restoreState(quests.getSnapshot().progress.map(q => q.questId === first.id ? { ...q, stageIndex: first.stages.length } : q))
  assert.equal(quests.acceptFromNpc(id, 'stranger'), false)
  assert.ok(!quests.getSnapshot().progress.some(q => q.questId === id))
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }])
  assert.equal(quests.acceptFromNpc(id, 'stranger'), true)
  assert.ok(inventory.getSnapshot().keyItems.includes('mother-safe-key'))
})
