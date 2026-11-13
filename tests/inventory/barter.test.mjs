import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { buildVendorSeeds } from '../../src/app/content/vendorSeeds.ts'

for (const id of ['bartender', 'cashier']) {
  test(`${id} dialogue opens stocked exchange and supports transfers in both directions`, () => {
    const input = content()
    const definition = input.dialogues[input.npcs[id].dialogueId]
    const inventory = new InventoryService(input.items, buildVendorSeeds({ [id]: definition }, input.items))
    inventory.grantItems([], 30)
    const dialogue = new DialogueService(containerId => {
      assert.equal(dialogue.getSnapshot().conversation, null)
      inventory.openContainer(containerId)
    })
    dialogue.openDialogue(input.npcs[id].name, definition)
    assert.ok(dialogue.getSnapshot().conversation.choices.some(choice => choice.text === '[Barter]'))
    dialogue.chooseReply('missing')
    assert.equal(inventory.getSnapshot().menu, null)
    dialogue.chooseReply('barter')
    assert.equal(inventory.getSnapshot().menu.containerId, definition.barter.id)
    const original = inventory.getSnapshot().containers[definition.barter.id].items
    const item = original[0]
    inventory.takeItem(item.itemId, 0)
    const price = input.items.find(definition => definition.id === item.itemId).price
    assert.equal(inventory.getSnapshot().money, 30 - price)
    assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId !== 'money'), [{ ...item, quantity: 1 }])
    inventory.storeItem(item.itemId)
    assert.equal(inventory.getSnapshot().money, 30 - price + Math.floor(price / 2))
    assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId !== 'money'), [])
    const total = stacks => stacks.reduce((sum, stack) => sum + stack.quantity, 0)
    assert.equal(total(inventory.getSnapshot().containers[definition.barter.id].items), total(original))
    dialogue.openDialogue(input.npcs[id].name, definition)
    dialogue.chooseReply('goodbye')
    assert.equal(dialogue.getSnapshot().conversation, null)
  })
}

test('barter configuration rejects missing stock, unknown goods and duplicate stock IDs', () => {
  const missing = content()
  delete missing.dialogues.bartender.barter
  assert.throws(() => validateContent(missing), /barter requires stock/)
  const unknown = content()
  unknown.dialogues.bartender.barter.items[0].itemId = 'missing'
  assert.throws(() => validateContent(unknown), /unknown item ID/)
  const duplicate = content()
  duplicate.dialogues.cashier.barter.id = duplicate.dialogues.bartender.barter.id
  assert.throws(() => validateContent(duplicate), /IDs must be unique/)
})
