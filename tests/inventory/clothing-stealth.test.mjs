import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue } from '../helpers/content.mjs'
import { createCharacter, calculateSkills } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses } from '../../src/domain/inventory/items.ts'
import { resolveSkillEffects } from '../../src/domain/skills/effects.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

const base = createCharacter({ id: 'test', name: 'Test', attributes: {
  strength: 4, agility: 4, intelligence: 4, willpower: 4, charisma: 4,
}, startingItems: [] })
const stack = itemId => ({ itemId, quantity: 1 })

test('clothing buffs and penalties change detection once per type and end on removal', () => {
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  for (const id of ['trainers', 'leather-boots', 'medical-coat']) {
    const item = definitions[id]
    const equipped = applyCarriedBonuses(base, [stack(id), stack(id)], definitions)
    assert.equal(equipped.skills.stealth, calculateSkills(equipped.attributes).stealth + item.stealthModifier)
    const withoutModifier = applyCarriedBonuses(base, [stack(id)], { ...definitions, [id]: { ...item, stealthModifier: 0 } })
    const before = resolveSkillEffects(withoutModifier.skills, data.skills).detection
    const after = resolveSkillEffects(equipped.skills, data.skills).detection
    assert.equal(after < before, item.stealthModifier > 0)
    assert.deepEqual(applyCarriedBonuses(equipped, [], definitions), base)
  }
  const both = applyCarriedBonuses(base, [stack('trainers'), stack('leather-boots')], definitions)
  assert.equal(both.skills.stealth, calculateSkills(both.attributes).stealth)
  assert.equal(both.skills.athletics, calculateSkills(both.attributes).athletics + 6)
})

test('unmet requirements block clothing effects and penalties never make skills negative', () => {
  const locked = { id: 'locked', stealthModifier: -10, skillRequirements: { medicine: 30 } }
  assert.deepEqual(applyCarriedBonuses(base, [stack('locked')], { locked }), base)
  const penalty = { id: 'penalty', stealthModifier: -10 }
  const low = createCharacter({ id: 'low', name: 'Low', attributes: {
    strength: 1, agility: 1, intelligence: 1, willpower: 1, charisma: 1,
  }, startingItems: [] })
  assert.equal(applyCarriedBonuses(low, [stack('penalty')], { penalty }).skills.stealth, 1)
})

test('stealth modifier validation rejects invalid values and non-clothing', () => {
  for (const patch of [{ stealthModifier: 11 }, { stealthModifier: -11 }, { stealthModifier: 1.5 },
    { stealthModifier: 0 }, { stealthModifier: 2, category: 'Food' }]) {
    const { data, sources } = catalogue()
    Object.assign(data.items.find(item => item.id === 'trainers'), patch)
    assert.throws(() => validateContent(data, sources), /stealthModifier/)
  }
})
