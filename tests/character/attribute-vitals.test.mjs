import assert from 'node:assert/strict'
import test from 'node:test'
import { attributeVitals } from '../../src/domain/skills/vitals.ts'
import { resolveDifficulty } from '../../src/domain/character/difficulty.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses } from '../../src/domain/inventory/items.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { content, contentFiles } from '../helpers/content.mjs'

const data = content()
const attributes = { strength: 4, agility: 3, intelligence: 9, willpower: 2, charisma: 9 }

test('Configured attributes add to starting and maximum vitals', () => {
  const before = structuredClone(data.ui.stats)
  const stats = attributeVitals(data.ui.stats, attributes)
  assert.deepEqual(stats.map(stat => [stat.id, stat.value, stat.max]), [
    ['health', 126, 126], ['energy', 141, 141], ['sanity', 196, 196],
  ])
  assert.deepEqual(data.ui.stats, before)
  assert.deepEqual(attributeVitals(data.ui.stats, { ...attributes, willpower: 3 }).map(stat => stat.max), [129, 144, 199])
})

test('flat bonuses apply after difficulty scaling and include configured starting equipment', () => {
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  for (const difficultyId of ['easy', 'normal', 'hard']) {
    const rules = resolveDifficulty(data.difficulty, difficultyId, { hero: data.hero.settings, stats: data.ui.stats, rest: data.ui.rest, timeCosts: data.daytime.statCostsPerPhase })
    for (const definition of contentFiles()['./classes.json']) {
      const hero = applyCarriedBonuses(createCharacter(definition), definition.startingItems.map(itemId => ({ itemId, quantity: 1 })), definitions)
      const stats = attributeVitals(rules.stats, hero.attributes)
      const status = new StatusService(stats)
      for (const stat of stats) {
        const bonus = hero.attributes.willpower * 3 + (stat.id === 'health' ? hero.attributes.strength * 5 : stat.id === 'energy' ? (hero.attributes.strength + hero.attributes.agility) * 5 : (hero.attributes.charisma + hero.attributes.intelligence) * 5)
        const base = rules.stats.find(entry => entry.id === stat.id)
        assert.equal(status.getSnapshot()[stat.id], base.value + bonus)
        assert.equal(status.getLimits()[stat.id], base.max + bonus)
        assert.equal(status.getSnapshot()[stat.id], status.getLimits()[stat.id], `${difficultyId}/${definition.id}/${stat.id} starts full`)
      }
    }
  }
})

test('changing attribute caps never grants healing, clamps excess and cannot resurrect a dead hero', () => {
  const initial = attributeVitals(data.ui.stats, attributes)
  const status = new StatusService(initial)
  status.takeDamage(20)
  const before = status.getSnapshot()
  status.setLimits(attributeVitals(data.ui.stats, { ...attributes, strength: 5 }))
  assert.deepEqual(status.getSnapshot(), before)
  assert.equal(status.getLimits().health, 131)
  status.recover({ health: 1000, energy: 1000, sanity: 1000 })
  assert.deepEqual(status.getSnapshot(), { health: 131, energy: 146, sanity: 196 })
  status.setLimits(initial)
  assert.equal(status.getSnapshot().health, 126)
  status.takeDamage(1000)
  status.setLimits(attributeVitals(data.ui.stats, { ...attributes, strength: 6 }))
  assert.equal(status.getSnapshot().health, 0)
  const unchanged = status.getSnapshot()
  status.setLimits(attributeVitals(data.ui.stats, { ...attributes, strength: 6 }))
  assert.equal(status.getSnapshot(), unchanged)
})

test('invalid attribute mapping and negative point amounts fail content validation', () => {
  const invalid = content()
  invalid.ui.stats[0].attributeBonuses[0].attribute = 'unknown'
  assert.throws(() => validateContent(invalid), /attribute/)
  const negative = content()
  negative.ui.stats[0].attributeBonuses[0].pointsPerAttribute = -5
  assert.throws(() => validateContent(negative), /pointsPerAttribute/)
})
