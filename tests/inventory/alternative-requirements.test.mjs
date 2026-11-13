import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { understandsItem, unmetItemRequirements, applyCarriedBonuses, itemRequirementStates } from '../../src/domain/inventory/items.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { catalogue, contentFiles } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('either education or training reveals and enables an alternative item', () => {
  const item = { id: 'med', eruditionRequired: 12, skillRequirements: { medicine: 10 }, requirementMode: 'any', consumable: true, recovery: { health: 10 } }
  for (const skills of [{ erudition: 12, medicine: 1 }, { erudition: 1, medicine: 10 }]) {
    assert.equal(understandsItem(item, skills.erudition, skills), true)
    assert.deepEqual(unmetItemRequirements(item, skills), [])
    let uses = 0
    const inventory = new InventoryService([item], [], () => 0, [{ itemId: 'med', quantity: 1 }], { recover: () => { uses++; return true } },
      undefined, undefined, undefined, () => skills.erudition, false, undefined, undefined, () => skills)
    inventory.openInventory(); inventory.useItem(0)
    assert.equal(uses, 1)
    assert.deepEqual(inventory.getSnapshot().items, [])
  }
  assert.equal(understandsItem(item, 11, { medicine: 9 }), false)
  assert.equal(unmetItemRequirements(item, { erudition: 11, medicine: 9 }).length, 2)
})

test('failed alternatives conceal skill thresholds without spending items, and skill loss disables use again', () => {
  let skills = { erudition: 1, medicine: 9 }
  const item = { id: 'med', requirementMode: 'any', eruditionRequired: 12, skillRequirements: { medicine: 10 }, consumable: true, maxStack: 5 }
  const messages = []
  const inventory = new InventoryService([item], [], () => 0, [{ itemId: 'med', quantity: 2 }], undefined,
    undefined, undefined, message => messages.push(message), () => skills.erudition, false, undefined, undefined, () => skills)
  assert.equal(inventory.consumeItem('med'), false)
  assert.equal(messages[0], 'Requires Erudition 12')
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  skills = { ...skills, medicine: 10 }
  assert.equal(inventory.understandsItem('med'), true)
  skills = { ...skills, medicine: 9 }
  assert.equal(inventory.understandsItem('med'), false)
})

test('permanent bonuses apply without meeting alternatives; active item requirements remain separate', () => {
  const base = createCharacter({ id: 'test', name: 'Test', attributes: { strength: 1, agility: 1, intelligence: 1, willpower: 1, charisma: 1 }, startingItems: [] })
  const item = { id: 'tool', requirementMode: 'any', eruditionRequired: 20, skillRequirements: { scraper: 8 }, bonus: { skill: 'scraper', amount: 10 } }
  assert.equal(applyCarriedBonuses(base, [{ itemId: 'tool', quantity: 1 }], { tool: item }).skills.scraper, base.skills.scraper + 10)
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  for (const definition of contentFiles()['./classes.json']) {
    const hero = createCharacter(definition)
    const equipped = applyCarriedBonuses(hero, definition.startingItems.map(itemId => ({ itemId, quantity: 1 })), definitions)
    for (const id of definition.startingItems) assert.deepEqual(unmetItemRequirements(definitions[id], equipped.skills), [], `${definition.id}: ${id}`)
  }
  assert.ok(unmetItemRequirements(definitions.pliers, base.skills).length)
})

test('alternative mode rejects typos and missing alternative skills', () => {
  for (const patch of [{ requirementMode: 'or' }, { requirementMode: 'any', skillRequirements: {} }]) {
    const { data, sources } = catalogue()
    Object.assign(data.items.find(item => item.id === 'pliers'), patch)
    assert.throws(() => validateContent(data, sources), /requirementMode/)
  }
})

test('education thresholds exceed all specialized alternatives and invalid authored thresholds fail', () => {
  const { data } = catalogue()
  for (const item of data.items.filter(item => item.requirementMode === 'any')) {
    for (const required of Object.values(item.skillRequirements)) assert.ok(item.eruditionRequired > required, item.id)
  }
  for (const level of [4, 5]) {
    const { data, sources } = catalogue()
    const item = data.items.find(item => item.id === 'pliers')
    item.eruditionRequired = level
    assert.throws(() => validateContent(data, sources), /education must exceed/)
  }
  assert.equal(data.items.find(item => item.id === 'encyclopedia').eruditionRequired, 4)
})

test('requirement states distinguish fulfilled, unmet, and unused alternatives', () => {
  const item = { id: 'tool', eruditionRequired: 12, skillRequirements: { scraper: 8 }, requirementMode: 'any' }
  const states = skills => itemRequirementStates(item, skills).map(entry => entry.state)
  assert.deepEqual(states({ erudition: 3, scraper: 4 }), ['unmet', 'unmet'])
  assert.deepEqual(states({ erudition: 12, scraper: 4 }), ['fulfilled', 'irrelevant'])
  assert.deepEqual(states({ erudition: 3, scraper: 8 }), ['irrelevant', 'fulfilled'])
  assert.deepEqual(states({ erudition: 12, scraper: 8 }), ['fulfilled', 'fulfilled'])
  assert.deepEqual(itemRequirementStates({ ...item, requirementMode: undefined }, { erudition: 12, scraper: 4 }).map(entry => entry.state), ['fulfilled', 'unmet'])
})
