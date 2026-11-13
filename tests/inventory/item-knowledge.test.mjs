import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
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

test('Encyclopedia reveals and activates previously unknown gear; removal hides and disables it again', () => {
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  const base = createCharacter({ id: 'reader', name: 'Reader', attributes: {
    strength: 2, agility: 1, intelligence: 2, willpower: 2, charisma: 2,
  }, startingItems: [] })
  const magazine = { itemId: 'sewing-magazine', quantity: 1 }
  const encyclopedia = { itemId: 'encyclopedia', quantity: 1 }
  const unknown = applyCarriedBonuses(base, [magazine], definitions)
  assert.equal(understandsItem(definitions[magazine.itemId], unknown.skills.erudition), false)
  assert.equal(unknown.skills.lockpicking, base.skills.lockpicking)
  const known = applyCarriedBonuses(base, [magazine, encyclopedia], definitions)
  assert.equal(understandsItem(definitions[magazine.itemId], known.skills.erudition), true)
  assert.equal(known.skills.lockpicking, base.skills.lockpicking + 2)
  assert.deepEqual(applyCarriedBonuses(known, [magazine], definitions), unknown)
})
