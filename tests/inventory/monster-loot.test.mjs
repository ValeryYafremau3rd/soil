import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { rollCorpseLoot } from '../../src/domain/combat/patrolCombat.ts'

const data = content()
const monsters = Object.values(data.patrols.types)
  .filter(type => type.kind === 'monster')
  .sort((left, right) => left.combat.health - right.combat.health)

test('stronger monsters have higher chances for rare and legendary rewards', () => {
  const previousChances = new Map()
  let rewardIds

  for (const monster of monsters) {
    const rewards = monster.corpseLoot.filter(drop => drop.chance !== undefined)
    assert.ok(rewards.length > 0, monster.name)
    const chancesByRarity = new Map()
    const ids = rewards.map(drop => drop.itemId)
    if (rewardIds) assert.deepEqual(ids, rewardIds)
    rewardIds = ids

    for (const reward of rewards) {
      const item = data.items.find(item => item.id === reward.itemId)
      assert.ok(['rare', 'legendary'].includes(item.rarity), item.id)
      assert.notEqual(item.category, 'Quest')
      assert.ok(reward.chance > (previousChances.get(item.id) ?? 0), monster.name)
      assert.ok(reward.chance < 1, item.id)
      previousChances.set(item.id, reward.chance)
      chancesByRarity.set(item.rarity, reward.chance)
      assert.equal(reward.min, 1)
      assert.equal(reward.max, 1)
    }

    assert.ok(chancesByRarity.get('legendary') < chancesByRarity.get('rare'))
  }
})

test('rare and legendary monster drops respect probability boundaries and allow empty rolls', () => {
  for (const monster of monsters) {
    const rewards = monster.corpseLoot.filter(drop => drop.chance !== undefined)
    assert.deepEqual(rollCorpseLoot(rewards, () => 0.99), [])

    for (const reward of rewards) {
      assert.deepEqual(rollCorpseLoot([reward], () => reward.chance - 0.0001), [
        { itemId: reward.itemId, quantity: 1 },
      ])
      assert.deepEqual(rollCorpseLoot([reward], () => reward.chance), [])
    }
  }
})

test('Titan retains its guaranteed key whether rare reward rolls succeed or fail', () => {
  const drops = data.patrols.types.titan.corpseLoot
  assert.deepEqual(rollCorpseLoot(drops, () => 0.99), [
    { itemId: 'strange-key', quantity: 1 },
  ])
  assert.equal(rollCorpseLoot(drops, () => 0).length, drops.length)
})
