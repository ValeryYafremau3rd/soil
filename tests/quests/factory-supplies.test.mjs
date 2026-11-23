import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { vehicleSeeds } from '../../src/app/content/vehicleSeeds.ts'
import { VehicleSearchService } from '../../src/app/services/world/VehicleSearchService.ts'

function setup() {
  const data = content()
  const inventory = new InventoryService(data.items, vehicleSeeds([{ id: 'factory-big-car', locationId: 'factory' }]))
  const quests = new QuestService(data.quests, inventory)
  const dialogue = new DialogueService()
  let night = false
  const skills = {}
  const vehicles = new VehicleSearchService(dialogue, inventory, quests, id => skills[id] ?? 0, () => night)
  const choices = () => dialogue.getSnapshot().conversation.choices.map(c => c.id)
  return { inventory, quests, dialogue, vehicles, skills, choices, setNight: value => { night = value } }
}

test('supplies require the previous quest and ordered clerk, worker, truck and report stages', () => {
  const { quests, vehicles, dialogue, skills, choices } = setup()
  const id = 'factory-supplies'
  assert.equal(quests.acceptFromNpc(id, 'worker'), false)
  quests.restoreState([
    { questId: 'mechanic-scrap', stageIndex: 2 },
    { questId: 'town-opinions', stageIndex: 8 },
  ])
  assert.equal(quests.acceptFromNpc(id, 'worker'), true)
  vehicles.open('factory-big-car')
  dialogue.chooseReply('approach')
  assert.deepEqual(choices(), ['leave'])
  skills.stealth = 8
  assert.equal(quests.advanceDialogue(id, 'worker', 'supplies-return'), false)
  assert.equal(quests.advanceDialogue(id, 'citizen-clerk', 'supplies-clerk'), true)
  assert.equal(quests.advanceDialogue(id, 'worker', 'supplies-return'), true)
  vehicles.open('factory-big-car')
  dialogue.chooseReply('approach')
  assert.ok(choices().includes('crates'))
  dialogue.chooseReply('crates')
  assert.match(dialogue.getSnapshot().conversation.text, /empty/)
  assert.equal(quests.advanceDialogue(id, 'worker', 'supplies-crates'), false)
  assert.equal(quests.advanceDialogue(id, 'worker', 'supplies-report'), true)
  assert.equal(quests.isCompleted(id), true)
})

test('night searches recheck skills, preserve daily contents on reopening and refresh in morning', () => {
  const { inventory, vehicles, dialogue, skills, choices, setNight } = setup()
  setNight(true)
  skills.lockpicking = 6
  skills.scraper = 8
  vehicles.open('factory-big-car')
  dialogue.chooseReply('approach')
  assert.ok(!choices().includes('crates'))
  assert.ok(choices().includes('pick'))
  skills.lockpicking = 5
  dialogue.chooseReply('pick')
  assert.ok(choices().includes('pick')) // Published menu is stale; the action still rechecks.
  skills.athletics = 8
  vehicles.open('factory-big-car')
  dialogue.chooseReply('approach')
  dialogue.chooseReply('break')
  assert.ok(choices().includes('parts'))
  assert.ok(!choices().includes('valuables'))
  // Simulate ordinary window coordination when opening the loot menu.
  const unsubscribe = inventory.subscribe(() => {
    if (inventory.getSnapshot().menu) dialogue.closeDialogue()
  })
  dialogue.chooseReply('parts')
  assert.equal(dialogue.getSnapshot().conversation, null)
  const key = 'factory-big-car:parts'
  assert.equal(inventory.getSnapshot().containers[key].items.length, 1)
  inventory.takeAll()
  assert.equal(inventory.getSnapshot().containers[key].items.length, 0)
  const saved = inventory.saveState()
  inventory.restoreState(saved)
  assert.deepEqual(inventory.saveState(), saved)
  inventory.refreshContainers('night')
  assert.equal(inventory.getSnapshot().containers[key].items.length, 0)
  inventory.refreshContainers()
  assert.equal(inventory.getSnapshot().containers[key].items.length, 1)
  unsubscribe()
})
