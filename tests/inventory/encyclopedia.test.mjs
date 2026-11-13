import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue, contentFiles } from '../helpers/content.mjs'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses, unmetItemRequirements } from '../../src/domain/inventory/items.ts'

test('Encyclopedia opens reading progression to low-Erudition classes without duplicate stacking', () => {
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  const book = definitions.encyclopedia
  assert.equal(book.eruditionRequired, 4)
  assert.deepEqual(unmetItemRequirements(book, { erudition: 4 }), [])
  assert.deepEqual(book.bonus, { skill: 'erudition', amount: 3 })
  for (const definition of contentFiles()['./classes.json']) {
    const base = createCharacter(definition)
    const carried = [{ itemId: book.id, quantity: 1 }]
    const boosted = applyCarriedBonuses(base, carried, definitions)
    assert.equal(boosted.skills.erudition, Math.min(20, base.skills.erudition + 3))
    assert.deepEqual(applyCarriedBonuses(base, [...carried, ...carried], definitions), boosted)
    assert.deepEqual(applyCarriedBonuses(boosted, [], definitions), base)
  }
})

test('the Encyclopedia is a guaranteed finite rooftop reward', () => {
  const location = contentFiles()['./locations/center.json']
  const crate = location.containers.find(container => container.id === 'bar-roof-crate')
  assert.ok(crate.items.some(item => item.itemId === 'encyclopedia' && item.quantity === 1))
  assert.equal(crate.restock, false)
  assert.equal(crate.locked, false)
})
