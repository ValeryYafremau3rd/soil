import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue, contentFiles } from '../helpers/content.mjs'
import { createCharacter, ATTRIBUTE_LABELS, SKILL_LABELS } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses, itemBonuses } from '../../src/domain/inventory/items.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

const stack = itemId => ({ itemId, quantity: 1 })

test('every class can collect beginner and advanced reading bonuses for every skill and attribute', () => {
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  for (const definition of contentFiles()['./classes.json']) {
    const base = createCharacter(definition)
    const references = ['encyclopedia', 'leather-journal', 'erudition-training-magazine'].map(stack)
    const prepared = applyCarriedBonuses(base, references, definitions)
    for (const skill of Object.keys(SKILL_LABELS)) {
      const beginner = `${skill}-training-magazine`, advanced = `${skill}-training-handbook`
      const first = applyCarriedBonuses(base, [...references, stack(beginner)], definitions)
      assert.equal(first.skills[skill], Math.min(skill === 'erudition' ? 20 : Infinity, prepared.skills[skill] + (skill === 'erudition' ? 0 : 2)), `${definition.id}: ${skill} beginner`)
      const both = applyCarriedBonuses(base, [...references, stack(advanced), stack(beginner)], definitions)
      assert.equal(both.skills[skill], Math.min(skill === 'erudition' ? 20 : Infinity, prepared.skills[skill] + (skill === 'erudition' ? 4 : 6)), `${definition.id}: ${skill} advanced`)
    }
    for (const attribute of Object.keys(ATTRIBUTE_LABELS)) {
      const items = [...references, ...[`${attribute}-training-pocket-guide`, `${attribute}-training-handbook`].map(stack)]
      assert.equal(applyCarriedBonuses(base, items, definitions).attributes[attribute], base.attributes[attribute] + 3, `${definition.id}: ${attribute}`)
    }
  }
})

test('multiple attribute and skill bonuses apply once per type and end together on removal', () => {
  const base = createCharacter({ id: 'test', name: 'Test', attributes: { strength: 1, agility: 1, intelligence: 1, willpower: 1, charisma: 1 }, startingItems: [] })
  const item = { id: 'gear', bonuses: [{ attribute: 'strength', amount: 2 }, { attribute: 'agility', amount: 1 }, { skill: 'stealth', amount: 3 }] }
  const equipped = applyCarriedBonuses(base, [stack('gear'), stack('gear')], { gear: item })
  assert.equal(equipped.attributes.strength, 3)
  assert.equal(equipped.attributes.agility, 2)
  assert.equal(equipped.skills.stealth, 8)
  assert.deepEqual(applyCarriedBonuses(equipped, [], { gear: item }), base)
  const locked = { ...item, eruditionRequired: 15, bonuses: [{ attribute: 'intelligence', amount: 3 }, { skill: 'erudition', amount: 5 }] }
  const carried = applyCarriedBonuses(base, [stack('gear')], { gear: locked })
  assert.equal(carried.attributes.intelligence, base.attributes.intelligence + 3)
  assert.equal(carried.skills.erudition, base.skills.erudition + 11)
  assert.deepEqual(applyCarriedBonuses(base, [{ itemId: 'gear', quantity: 0 }], { gear: locked }), base)
  assert.deepEqual(applyCarriedBonuses(base, [stack('gear')], { gear: { ...locked, consumable: true } }), base)
})

test('multi-bonus content rejects duplicate targets, invalid amounts and bonuses on scrap', () => {
  for (const bonuses of [[{ attribute: 'agility', amount: 4 }], [{ skill: 'stealth', amount: 11 }],
    [{ attribute: 'agility', amount: 1 }, { attribute: 'agility', amount: 2 }], []]) {
    const { data, sources } = catalogue()
    const belt = data.items.find(item => item.id === 'leather-belt')
    delete belt.bonus
    belt.bonuses = bonuses
    assert.throws(() => validateContent(data, sources), /bonuses/)
  }
  const { data, sources } = catalogue()
  data.items.find(item => item.scrap).bonuses = [{ attribute: 'strength', amount: 1 }]
  assert.throws(() => validateContent(data, sources), /scrap/)
  assert.ok(data.items.some(item => itemBonuses(item).some(bonus => 'attribute' in bonus)))
})

test('non-reading attribute equipment has exactly one +1 source per attribute', () => {
  const { data } = catalogue()
  const gear = data.items.filter(item => item.category !== 'Book')
  for (const attribute of Object.keys(ATTRIBUTE_LABELS)) {
    const sources = gear.filter(item => itemBonuses(item).some(bonus => 'attribute' in bonus && bonus.attribute === attribute))
    assert.equal(sources.length, 1, attribute)
    assert.ok(['epic', 'legendary'].includes(sources[0].rarity), attribute)
    assert.equal(itemBonuses(sources[0]).find(bonus => bonus.attribute === attribute).amount, 1)
  }
})
