import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue, contentFiles } from '../helpers/content.mjs'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { createCharacter } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses, unmetItemRequirements } from '../../src/domain/inventory/items.ts'

test('Erudition magazine grants one learned point per issue without duplicate stacking', () => {
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  const book = definitions['health-magazine-erudition']
  assert.equal(book.eruditionRequired, 4)
  assert.deepEqual(unmetItemRequirements(book, { erudition: 4 }), [])
  assert.deepEqual(book.bonus, { skill: 'erudition', amount: 1 })
  for (const definition of classes) {
    const base = createCharacter(definition)
    const carried = [{ itemId: book.id, quantity: 1, learned: true }]
    const boosted = applyCarriedBonuses(base, carried, definitions)
    assert.equal(boosted.skills.erudition, Math.min(20, base.skills.erudition + 1))
    assert.deepEqual(applyCarriedBonuses(base, [...carried, ...carried], definitions), boosted)
    assert.deepEqual(applyCarriedBonuses(boosted, [], definitions), base)
  }
})

test('the sci-fi novel replaces the finite rooftop reading reward', () => {
  const crate = contentFiles()['./locations/center/containers.json'].find(container => container.id === 'bar-roof-crate')
  assert.ok(crate.items.some(item => item.itemId === 'sci-fi-book' && item.quantity === 1))
  assert.equal(crate.restock, false)
  assert.equal(crate.locked, false)
})
