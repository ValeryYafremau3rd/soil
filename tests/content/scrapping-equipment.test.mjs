import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { scrapReward } from '../../src/domain/inventory/scrap.ts'

test('ordinary and legendary scrap rolls can select every equippable item', () => {
  const data = content()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  for (const skill of [0, data.skills.legendary.threshold]) {
    const pool = data.skills.scrapping.rewards.filter(reward =>
      skill < data.skills.legendary.threshold || !definitions[reward.itemId].ammunition)
    const weights = pool.map(reward =>
      data.skills.scrapping.rarityWeights[definitions[reward.itemId].rarity])
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let previous = 0
    for (const [index, reward] of pool.entries()) {
      if (definitions[reward.itemId].equipmentSlot) {
        const rolls = [0, 0, (previous + weights[index] / 2) / total]
        assert.deepEqual(scrapReward(skill, definitions, () => rolls.shift()), reward,
          `${reward.itemId} at Scraper ${skill}`)
      }
      previous += weights[index]
    }
  }
})

test('scrapping can recover every equippable item once in the weighted reward pool', () => {
  const data = content()
  const rewards = data.skills.scrapping.rewards
  const equipment = data.items.filter(item => item.equipmentSlot)
  assert.ok(equipment.length > 0)
  for (const item of equipment) {
    const entries = rewards.filter(reward => reward.itemId === item.id)
    assert.equal(entries.length, 1, item.id)
    assert.equal(entries[0].quantity, 1, item.id)
    assert.ok(data.skills.scrapping.rarityWeights[item.rarity] > 0, item.id)
  }
})

test('scrapping excludes scrap and rejects scrap added to its rewards', () => {
  const { data, sources } = catalogue()
  const definitions = new Map(data.items.map(item => [item.id, item]))
  for (const reward of data.skills.scrapping.rewards) {
    assert.equal(Boolean(definitions.get(reward.itemId)?.scrap), false, reward.itemId)
    assert.notEqual(definitions.get(reward.itemId)?.category, 'Scrap', reward.itemId)
  }
  data.skills.scrapping.rewards.push({ itemId: 'bent-nails', quantity: 1 })
  assert.throws(() => validateContent(data, sources), /scrapping.rewards.*useful/)
})
