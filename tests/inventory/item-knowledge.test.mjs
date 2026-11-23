import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { applyCarriedBonuses, understandsItem } from '../../src/domain/inventory/items.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { catalogue } from '../helpers/content.mjs'

test('Erudition reveals knowledge independently of training and blocks repeated unknown use', () => {
  let erudition = 1, recovered = 0
  const messages = []
  const item = { id: 'medicine', eruditionRequired: 6, skillRequirements: { medicine: 8 }, consumable: true, maxStack: 5, recovery: { health: 20 } }
  const inventory = new InventoryService([item], [], () => 0, [{ itemId: item.id, quantity: 2 }],
    { recover: () => { recovered++; return true } }, undefined, undefined, text => messages.push(text), () => erudition)
  inventory.openInventory()
  assert.equal(inventory.understandsItem(item.id), false)
  inventory.useItem(0); inventory.useItem(0)
  assert.equal(inventory.consumeItem(item.id), false)
  assert.deepEqual(messages, Array(3).fill('Requires Erudition 6'))
  assert.equal(recovered, 0)
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  erudition = 6
  assert.equal(inventory.understandsItem(item.id), true)
  assert.equal(inventory.meetsItemRequirements(item.id), false, 'knowledge does not replace Medicine training')
  assert.equal(inventory.understandsItem('missing'), false)
})

test('learning Erudition reveals advanced reading without granting unread bonuses', () => {
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  const base = createCharacter({ id: 'reader', name: 'Reader', attributes: {
    strength: 2, agility: 1, intelligence: 2, willpower: 2, charisma: 2,
  }, startingItems: [] })
  const tome = { itemId: 'mechanics-lockpicking', quantity: 1 }
  const unknown = applyCarriedBonuses(base, [tome], definitions)
  assert.equal(understandsItem(definitions[tome.itemId], unknown.skills.erudition), false)
  const learned = ['health-magazine-erudition', 'chemistry-erudition', 'sci-fi-book'].map(itemId => ({ itemId, quantity: 1, learned: true }))
  const known = applyCarriedBonuses(base, [tome, ...learned], definitions)
  assert.equal(understandsItem(definitions[tome.itemId], known.skills.erudition), true)
  assert.equal(known.skills.lockpicking, base.skills.lockpicking)
})
