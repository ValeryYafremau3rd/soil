import assert from 'node:assert/strict'
import test from 'node:test'
import { itemRequirementStates, understandsItem, unmetItemRequirements } from '../../src/domain/inventory/items.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { resolveEffectiveCharacter } from '../../src/domain/skills/condition.ts'
import { catalogue } from '../helpers/content.mjs'

test('specialist items require their skill without a secondary education route', () => {
  const items = catalogue().data.items.filter(item => Object.keys(item.skillRequirements ?? {}).length > 0)
  assert.ok(items.length > 0)
  for (const item of items) {
    assert.equal(item.eruditionRequired, undefined, item.id)
    assert.equal(item.requirementMode, undefined, item.id)
    const requirements = itemRequirementStates(item, { erudition: 10 })
    assert.ok(requirements.every(requirement => requirement.skill !== 'erudition'), item.id)
  }
})

test('education reduces skill gates consistently for knowledge, use and display', () => {
  const book = { id: 'training', readable: true, skillRequirements: { medicine: 15 } }
  const skills = { erudition: 10, medicine: 8 }
  assert.equal(understandsItem(book, 10, skills), true)
  assert.deepEqual(unmetItemRequirements(book, skills), [])
  assert.deepEqual(itemRequirementStates(book, skills), [{ skill: 'medicine', required: 8, state: 'fulfilled' }])
  assert.equal(understandsItem(book, 10, { medicine: 7 }), false)
  assert.equal(understandsItem(book, 20, { medicine: 1 }), true)
})

test('novels retain their education gate', () => {
  const novel = { id: 'novel', eruditionRequired: 6 }
  assert.equal(understandsItem(novel, 5), false)
  assert.equal(understandsItem(novel, 6), true)
})

test('legendary education grants every skill one point without sustaining itself', () => {
  const base = createCharacter({ id: 'test', name: 'Test', attributes: { strength: 1, agility: 1, intelligence: 5, willpower: 5, charisma: 1 }, startingItems: [] })
  const resolve = character => resolveEffectiveCharacter(character, [], {}, { energy: 100, sanity: 100 },
    { energy: 100, sanity: 100 }, { counts: {}, acquired: [], habits: {} }, [], [])
  for (const [skill, value] of Object.entries(base.skills)) assert.equal(resolve(base).skills[skill], value + 1)
  const below = createCharacter({ id: 'below', name: 'Below', attributes: { ...base.baseAttributes, intelligence: 4, willpower: 6 }, startingItems: [] })
  assert.equal(resolve(below).skills.erudition, 14)
  assert.equal(resolve(below).skills.athletics, base.skills.athletics)
})
