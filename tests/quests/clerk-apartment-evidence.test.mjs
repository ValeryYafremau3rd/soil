import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { doorLocked } from '../../src/domain/buildings/lockpicking.ts'

const { data, sources } = catalogue()
const questId = 'clerk-apartment-evidence'
const itemId = 'suspicious-correspondence'
const quest = data.quests.find(entry => entry.id === questId)
const placement = data.containers.placements.find(entry => entry.questId === questId)
const seeds = buildContainerSeeds({ ...data.containers, placements: [placement] }, data.items)

/** Create real inventory, quest and dialogue services with controllable prerequisite progress. */
function setup(ready = true) {
  const inventory = new InventoryService(data.items, seeds, () => 0, [])
  const quests = new QuestService(data.quests, inventory, undefined, undefined,
    undefined, undefined, undefined, () => ({ barter: 10, persuasion: 4, intimidation: 2 }))
  quests.startInitialQuests()
  if (ready) {
    const completed = ['first-steps', 'find-work', 'town-opinions'].map(id => ({
      questId: id, stageIndex: data.quests.find(entry => entry.id === id).stages.length,
    }))
    quests.restoreState(completed)
  }
  const dialogue = new DialogueService(inventory.openContainer, {
    canOffer: quests.canOffer, acceptFromNpc: quests.acceptFromNpc,
    isCompleted: quests.isCompleted,
    canChoose: (npc, choice) => quests.canAdvanceDialogue(choice.questId, npc, choice.id),
    choose: (npc, choice) => quests.advanceDialogue(choice.questId, npc, choice.id),
  })
  return { inventory, quests, dialogue }
}

/** Open the clerk's real dialogue so reply visibility follows live quest state. */
function talk(dialogue) {
  dialogue.openDialogue('Pavel Sokolov', data.dialogues['citizen-clerk'], 'citizen-clerk')
}

test('investigation follows the last clerk quest and lists four normally locked NPC homes', () => {
  assert.doesNotThrow(() => validateContent(data, sources))
  assert.deepEqual(quest.prerequisites, ['town-opinions'])
  const { quests } = setup(false)
  assert.equal(quests.acceptFromNpc(questId, 'citizen-clerk'), false)
  for (const room of ['apartment-11', 'apartment-22', 'apartment-41', 'apartment-42']) {
    assert.ok(Object.values(data.npcs).some(npc => npc.schedule.night.roomId === room))
    assert.equal(doorLocked(false, room), true)
    assert.equal(doorLocked(true, room), true)
  }
  const ready = setup().quests
  assert.equal(ready.acceptFromNpc(questId, 'bartender'), false)
  assert.equal(ready.acceptFromNpc(questId, 'citizen-clerk'), true)
  assert.equal(ready.acceptFromNpc(questId, 'citizen-clerk'), false)
})

test('finding the letter in the first searched apartment allows reading and one paid handover', () => {
  const { inventory, quests, dialogue } = setup()
  talk(dialogue)
  dialogue.chooseReply('apartment-evidence-accept')
  assert.equal(quests.isActive(questId), true)
  assert.match(dialogue.getSnapshot().conversation.text, /11.*22.*41.*42/)
  assert.equal(quests.canAdvanceDialogue(questId, 'citizen-clerk',
    'apartment-evidence-report'), false)
  quests.visitRoom(placement.locationId, placement.buildingId, placement.roomId)
  inventory.openContainer(placement.id)
  inventory.takeAll()
  inventory.openInventory()
  inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === itemId))
  assert.equal(inventory.getSnapshot().menu.kind, 'reading')
  assert.match(inventory.getSnapshot().menu.text, /supply registers/)
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === itemId))
  const reward = quests.definitions.find(entry => entry.id === questId).reward.money
  talk(dialogue)
  dialogue.chooseReply('decision-topic-apartment_evidence_choice')
  dialogue.chooseReply('apartment-evidence-report')
  assert.equal(quests.isCompleted(questId), true)
  assert.equal(inventory.getSnapshot().money, reward)
  assert.ok(!inventory.getSnapshot().items.some(item => item.itemId === itemId))
  assert.equal(quests.advanceDialogue(questId, 'citizen-clerk',
    'apartment-evidence-report'), false)
  assert.equal(inventory.getSnapshot().money, reward)
})

test('evidence progress survives restore; storing the letter blocks handover and finite stock stays empty', () => {
  const { inventory, quests } = setup()
  quests.acceptFromNpc(questId, 'citizen-clerk')
  inventory.openContainer(placement.id)
  inventory.takeAll()
  const restored = setup()
  restored.inventory.restoreState(inventory.saveState())
  restored.quests.restoreState(quests.getSnapshot().progress)
  restored.inventory.openContainer(placement.id)
  restored.inventory.storeItem(itemId)
  assert.equal(restored.quests.advanceDialogue(questId, 'citizen-clerk',
    'apartment-evidence-report'), false)
  restored.inventory.takeItem(itemId)
  assert.equal(restored.quests.advanceDialogue(questId, 'citizen-clerk',
    'apartment-evidence-report'), true)
  restored.inventory.refreshContainers('morning')
  restored.inventory.refreshContainers('night')
  assert.deepEqual(restored.inventory.getSnapshot().containers[placement.id].items, [])
  const letter = data.items.find(item => item.id === itemId)
  assert.equal(letter.saleable, false)
  assert.equal(letter.randomLoot, false)
})
