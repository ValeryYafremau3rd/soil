import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue, content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { ATTRIBUTE_LABELS, SKILL_LABELS } from '../../src/domain/skills/character.ts'
import { itemBonuses } from '../../src/domain/inventory/items.ts'
import { consumeForBuffs, buffVitals } from '../../src/domain/character/perks.ts'
import buffs from '../../src/content/ui/consumable-buffs.json' with { type: 'json' }

test('rebalanced catalogue passes content validation, including Sanity capacity buffs', () => {
  const { data, sources } = catalogue()
  assert.doesNotThrow(() => validateContent(data, sources))
})

test('non-reading items cover every attribute and skill; consumables buff every vital', () => {
  const items = content().items.filter(item => !item.readable && !item.consumable)
  for (const [kind, labels] of [['attribute', ATTRIBUTE_LABELS], ['skill', SKILL_LABELS]]) {
    for (const target of Object.keys(labels)) {
      assert.ok(items.some(item => itemBonuses(item).some(bonus => bonus[kind] === target)), target)
    }
  }
  for (const vital of ['health', 'energy', 'sanity']) {
    assert.ok(buffs.some(buff => buff.vital === vital && buff.amount > 0), vital)
  }
})

test('tools, clothing and weapons each offer bonuses across all eleven skills', () => {
  const { items } = content()
  const groups = {
    tools: items.filter(item => item.equipmentSlot === 'tool'),
    clothing: items.filter(item => item.category === 'Clothing'),
    weapons: items.filter(item => ['melee', 'ranged'].includes(item.equipmentSlot)),
  }
  for (const [group, gear] of Object.entries(groups)) {
    for (const skill of Object.keys(SKILL_LABELS)) {
      assert.ok(gear.some(item => itemBonuses(item).some(bonus => bonus.skill === skill)), `${group}: ${skill}`)
    }
  }
})

test('every authored item caps direct skill bonuses at three, including combined Stealth', () => {
  for (const item of content().items) {
    for (const bonus of itemBonuses(item)) {
      if ('skill' in bonus) assert.ok(bonus.amount <= 3, `${item.id}: ${bonus.skill}`)
    }
    const stealth = itemBonuses(item).find(bonus => bonus.skill === 'stealth')?.amount ?? 0
    assert.ok(stealth + Math.max(0, item.stealthModifier ?? 0) <= 3, item.id)
  }
  for (const field of ['bonus', 'bonuses']) {
    const { data, sources } = catalogue()
    const item = data.items.find(item => item.id === 'wrench')
    delete item.bonus
    delete item.bonuses
    item[field] = field === 'bonus' ? { skill: 'scraper', amount: 4 } : [{ skill: 'scraper', amount: 4 }]
    assert.throws(() => validateContent(data, sources), /bonus/)
  }
})

test('items affecting multiple skills total exactly four, including clothing Stealth', () => {
  for (const item of content().items) {
    const bonuses = itemBonuses(item).filter(bonus => 'skill' in bonus)
    const targets = new Set(bonuses.map(bonus => bonus.skill))
    if (item.stealthModifier > 0) targets.add('stealth')
    if (targets.size < 2) continue
    assert.equal(bonuses.reduce((sum, bonus) => sum + bonus.amount, 0) + Math.max(0, item.stealthModifier ?? 0), 4, item.id)
  }
  for (const amounts of [[1, 1], [3, 2]]) {
    const { data, sources } = catalogue()
    const item = data.items.find(item => item.id === 'wrench')
    delete item.bonus
    item.bonuses = amounts.map((amount, index) => ({ skill: index ? 'medicine' : 'scraper', amount }))
    assert.throws(() => validateContent(data, sources), /must total 4/)
  }
})

test('reduced training preserves ascending tiers for the same specialist bonus', () => {
  const items = Object.fromEntries(content().items.map(item => [item.id, item]))
  for (const [low, high, skill] of [['rope', 'pipe-wrench', 'athletics'],
    ['pliers', 'precision-screwdriver', 'lockpicking'], ['frying-pan', 'hatchet', 'martialArts']]) {
    const bonus = id => itemBonuses(items[id]).find(bonus => bonus.skill === skill).amount
    assert.ok(bonus(low) < bonus(high))
    assert.ok(items[low].skillRequirements[skill] < Math.max(...Object.values(items[high].skillRequirements)))
  }
  assert.equal(items.rope.skillRequirements.athletics, 2)
  assert.equal(items['service-pistol'].skillRequirements.weapons, 12)
  assert.deepEqual(items['chemistry-erudition'].skillRequirements, { medicine: 12 })
})

test('Sanity capacity medicine refreshes without stacking and is replaced by other medicine', () => {
  const empty = { counts: {}, acquired: [], habits: {} }
  const stats = [{ id: 'sanity', max: 100 }]
  const first = consumeForBuffs(empty, buffs, 'white-tablets', 0, 4)
  const refreshed = consumeForBuffs(first, buffs, 'white-tablets', 1, 4)
  assert.equal(buffVitals(stats, first, buffs)[0].max, 115)
  assert.equal(buffVitals(stats, refreshed, buffs)[0].max, 115)
  assert.equal(refreshed.buffs.find(buff => buff.id === 'tablet-sanity').expiresAt, 5)
  const replaced = consumeForBuffs(refreshed, buffs, 'red-tablets', 1, 4)
  assert.equal(buffVitals(stats, replaced, buffs)[0].max, 100)
})

