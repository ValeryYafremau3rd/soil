import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { buildVendorSeeds } from '../../src/app/content/vendorSeeds.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

const shopId = 'merchant:citizen-nurse'
test('Nadia opens medical barter without quest progress, charges configured prices, and preserves purchases', () => {
  const data = content()
  const seeds = buildVendorSeeds(data.dialogues, data.items)
  const inventory = new InventoryService(data.items, seeds, () => 0)
  const dialogue = new DialogueService(inventory.openContainer)
  dialogue.openDialogue('Nadia Morozova', data.dialogues['citizen-nurse'], 'citizen-nurse')
  assert.ok(dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'barter'))
  dialogue.chooseReply('barter')
  assert.equal(dialogue.getSnapshot().conversation, null)
  assert.equal(inventory.getSnapshot().menu.containerId, shopId)
  const stock = () => inventory.getSnapshot().containers[shopId].items
  assert.ok(stock().length >= 4 && stock().length <= 5)
  assert.ok(stock().every(stack => data.items.find(item => item.id === stack.itemId).category === 'Medical'))
  const before = inventory.getSnapshot()
  inventory.takeItem('bandage', stock().findIndex(stack => stack.itemId === 'bandage'))
  assert.equal(inventory.getSnapshot(), before, 'no money means no stock or inventory changes')
  inventory.grantItems([], 20)
  const price = inventory.getPrice('bandage')
  inventory.takeItem('bandage', stock().findIndex(stack => stack.itemId === 'bandage'))
  assert.equal(inventory.getSnapshot().money, 20 - price)
  assert.equal(stock().find(stack => stack.itemId === 'bandage').quantity, 1)
  const saved = inventory.saveState()
  const restored = new InventoryService(data.items, seeds, () => 0.99)
  restored.restoreState(saved)
  assert.deepEqual(restored.getSnapshot().containers[shopId].items, stock())
  inventory.storeItem('bandage', inventory.getSnapshot().items.findIndex(stack => stack.itemId === 'bandage'))
  assert.equal(inventory.getSnapshot().money, 20 - price + Math.floor(price / 2))
  inventory.refreshContainers()
  assert.equal(stock().find(stack => stack.itemId === 'bandage').quantity, 3, 'morning stock preserves the unit sold by the hero')
})
