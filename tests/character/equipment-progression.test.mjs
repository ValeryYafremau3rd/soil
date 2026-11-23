import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue, contentFiles } from '../helpers/content.mjs'
import { createCharacter, ATTRIBUTE_LABELS, SKILL_LABELS } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses, itemBonuses } from '../../src/domain/inventory/items.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

const stack = itemId => ({ itemId, quantity: 1 })

test('every class learns all eleven skills through issues and tomes without gaining attributes', () => {
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  const sources = data.items.filter(item => item.readable && item.bonus).map(item => ({ ...stack(item.id), learned: true }))
  for (const definition of contentFiles()['./classes.json']) {
    const base = createCharacter(definition)
    const learned = applyCarriedBonuses(base, sources, definitions)
    for (const skill of Object.keys(SKILL_LABELS)) {
      assert.equal(learned.skills[skill], Math.min(skill === 'erudition' ? 20 : Infinity, base.skills[skill] + 3))
    }
    assert.deepEqual(learned.attributes, base.attributes)
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
