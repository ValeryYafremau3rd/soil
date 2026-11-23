import assert from 'node:assert/strict'
import test from 'node:test'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { content } from '../helpers/content.mjs'
import { applyCarriedBonuses, unmetItemRequirements } from '../../src/domain/inventory/items.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'

test('learned magazine and tome bonuses unlock specialist weapons without passive bonuses from unread copies', () => {
  const definitions = Object.fromEntries(content().items.map(item => [item.id, item]))
  const hero = createCharacter(classes.find(item => item.id === 'loader'))
  const sources = ['technical-magazine-weapons', 'mechanics-weapons', 'detective-book'].map(itemId => ({ itemId, quantity: 1, learned: true }))
  const trained = applyCarriedBonuses(hero, sources, definitions)
  assert.equal(trained.skills.weapons, hero.skills.weapons + 4)
  assert.deepEqual(applyCarriedBonuses(hero, sources.map(item => ({ itemId: item.itemId, quantity: 1 })), definitions), hero)
})
test('simple dressings are accessible; stronger treatments require training and tablets provide temporary tradeoffs', () => {
  const definitions = Object.fromEntries(content().items.map(item => [item.id, item]))
  for (const id of ['bandage', 'balm-tin']) assert.deepEqual(unmetItemRequirements(definitions[id], { erudition: 2, medicine: 1 }), [])
  for (const id of ['bandage-roll', 'antiseptic', 'antiseptic-bottle']) {
    assert.ok(unmetItemRequirements(definitions[id], { erudition: 1, medicine: 1 }).length)
    assert.deepEqual(unmetItemRequirements(definitions[id], { erudition: 1, medicine: definitions[id].skillRequirements.medicine }), [])
  }
  for (const id of ['medicine', 'medicine-bottle', 'medical-case', 'first-aid-kit', 'red-tablets', 'white-tablets']) {
    assert.ok(unmetItemRequirements(definitions[id], { erudition: 1, medicine: 1 }).length)
  }
  for (const id of ['white-tablets', 'red-tablets']) {
    assert.deepEqual(definitions[id].recovery, {})
    const effects = content().ui.consumableBuffs.filter(buff => buff.itemIds.includes(id))
    assert.ok(effects.some(effect => effect.amount > 0))
    assert.ok(effects.some(effect => effect.amount < 0))
  }
})
