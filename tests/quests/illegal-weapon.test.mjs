import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

/** Build the real one-time safe and unlock prerequisite jobs without granting rewards. */
function setup() {
  const data = content()
  const safe = buildContainerSeeds(data.containers, data.items)
    .find(seed => seed.id === 'smuggler-apartment-safe')
  const inventory = new InventoryService(data.items, [{ ...safe, locked: false }])
  const quests = new QuestService(data.quests, inventory)
  const prerequisites = [1, 2, 3].map(index => ({
    questId: `smuggler-${index}`,
    stageIndex: data.quests.find(quest => quest.id === `smuggler-${index}`).stages.length,
  }))
  quests.restoreState(prerequisites)
  return { data, inventory, quests, prerequisites }
}

test('previously looted and spent safe contents count after reload without refilling the safe', () => {
  const { inventory, quests, prerequisites } = setup()
  inventory.openContainer('smuggler-apartment-safe')
  inventory.takeAll()
  inventory.removeItems([
    { itemId: 'service-pistol', quantity: 1 }, { itemId: 'pistol-ammunition', quantity: 5 },
  ])
  const saved = inventory.saveState()
  saved.equipment = { ...saved.equipment, ranged: 'service-pistol' }
  inventory.restoreState(saved)
  quests.restoreState(prerequisites)
  assert.equal(quests.acceptFromNpc('smuggler-4', 'citizen-mechanic'), true)
  assert.equal(quests.isCompleted('smuggler-4'), true)
  assert.equal(inventory.getSnapshot().equipment.ranged, 'service-pistol')
  assert.deepEqual(inventory.getSnapshot().containers['smuggler-apartment-safe'].items, [])
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'precision-screwdriver')
    || Object.values(inventory.getSnapshot().equipment).includes('precision-screwdriver'))
  const rewarded = inventory.saveState()
  quests.restoreState(quests.getSnapshot().progress)
  assert.equal(quests.acceptFromNpc('smuggler-4', 'citizen-mechanic'), false)
  assert.deepEqual(inventory.saveState(), rewarded)
})

test('a partially looted safe still requires its remaining ammunition', () => {
  const { inventory, quests } = setup()
  inventory.openContainer('smuggler-apartment-safe')
  inventory.takeItem('service-pistol')
  inventory.removeItems([{ itemId: 'service-pistol', quantity: 1 }])
  quests.acceptFromNpc('smuggler-4', 'citizen-mechanic')
  assert.equal(quests.isCompleted('smuggler-4'), false)
  assert.equal(quests.getSnapshot().progress.find(entry => entry.questId === 'smuggler-4')
    .stageIndex, 1)
  inventory.takeAll()
  assert.equal(quests.isCompleted('smuggler-4'), true)
})

test('historical collection rejects missing, replenishing or mismatched sources', () => {
  for (const change of [
    data => { data.quests.find(q => q.id === 'smuggler-4').stages[0].collectedFrom = 'missing' },
    data => { data.containers.placements.find(c => c.id === 'smuggler-apartment-safe').restock = true },
    data => { data.quests.find(q => q.id === 'smuggler-4').stages[0].requiredItems[0].quantity = 2 },
  ]) {
    const data = content()
    change(data)
    assert.throws(() => validateContent(data), /collectedFrom/)
  }
})

test('earlier safe loot keeps a full-inventory reward pending and pays exactly once', () => {
  const { inventory, quests } = setup()
  inventory.openContainer('smuggler-apartment-safe')
  inventory.takeAll()
  inventory.removeItems([
    { itemId: 'service-pistol', quantity: 1 }, { itemId: 'pistol-ammunition', quantity: 5 },
  ])
  inventory.grantItems(['letter', 'postcard', 'cloth', 'rope', 'bread', 'bandage']
    .map(itemId => ({ itemId, quantity: 1 })))
  quests.acceptFromNpc('smuggler-4', 'citizen-mechanic')
  assert.equal(quests.isCompleted('smuggler-4'), false)
  inventory.removeItems([{ itemId: 'bread', quantity: 1 }])
  assert.equal(quests.isCompleted('smuggler-4'), true)
  const rewarded = inventory.saveState()
  quests.restoreState(quests.getSnapshot().progress)
  assert.deepEqual(inventory.saveState(), rewarded)
})
