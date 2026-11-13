import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { AttackTiming } from '../../src/domain/combat/attackTiming.ts'
import { chargePerkAction, emptyPerks, progressForAction, perkChargeDamage } from '../../src/domain/character/perks.ts'
const data = content(), definitions = data.ui.perks

test('charge threshold is strict, symmetric over the timing cycle, and cancelled releases do not score', () => {
  for (const kind of ['melee', 'shot']) {
    const timing = new AttackTiming(data.hero.settings.attackTiming)
    timing.begin(kind)
    for (const [delta, action] of [[0, 'attackBelowHalf'], [250, undefined], [1, 'attackAboveHalf'], [499, undefined], [1, 'attackBelowHalf']]) {
      timing.update(delta)
      assert.equal(chargePerkAction(timing.chargeRatio, 1), action)
    }
    timing.cancel()
    assert.equal(timing.release(), undefined)
  }
  for (const charge of [NaN, Infinity, -1, 2]) assert.equal(chargePerkAction(charge, 1), undefined)
})

test('first charge perk wins independently and modifies both attack kinds only after acquisition', () => {
  for (const [id, other, action, start, full] of [
    ['sniper', 'brawler', 'attackAboveHalf', 0.75, 2.25],
    ['brawler', 'sniper', 'attackBelowHalf', 1.25, 1.75],
  ]) {
    let state = emptyPerks()
    assert.equal(definitions.find(perk => perk.id === id).goal, 20)
    for (let i = 0; i < 19; i++) state = progressForAction(state, definitions, action)
    assert.deepEqual(state.acquired, [])
    assert.equal(state.counts[id], 19)
    assert.equal(perkChargeDamage(state, definitions, 0), 0)
    state = progressForAction(state, definitions, action)
    for (let i = 0; i < 20; i++) state = progressForAction(state, definitions, other === 'sniper' ? 'attackAboveHalf' : 'attackBelowHalf')
    assert.deepEqual(state.acquired, [id])
    assert.equal(state.counts[other] ?? 0, 0)
    const restored = JSON.parse(JSON.stringify(state))
    for (const kind of ['melee', 'shot']) {
      const timing = new AttackTiming(data.hero.settings.attackTiming, charge => perkChargeDamage(restored, definitions, charge))
      timing.begin(kind)
      assert.equal(timing.damageMultiplier, start)
      timing.update(250)
      assert.equal(timing.damageMultiplier, 1.5)
      timing.update(250)
      assert.equal(timing.release().multiplier, full)
      assert.equal(timing.release(), undefined)
    }
  }
})

test('misses and zero damage never progress either charge perk', () => {
  for (const charge of [0, 0.25, 0.5, 0.75, 1]) {
    for (const damage of [0, -1, NaN, Infinity]) assert.equal(chargePerkAction(charge, damage), undefined)
  }
  assert.equal(chargePerkAction(0, 1), 'attackBelowHalf')
  assert.equal(chargePerkAction(1, 1), 'attackAboveHalf')
})
