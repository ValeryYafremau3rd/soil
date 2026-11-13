import assert from 'node:assert/strict'
import test from 'node:test'
import { AttackTiming } from '../../src/domain/combat/attackTiming.ts'
import { content, catalogue } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

const settings = content().hero.settings.attackTiming

test('ring shrinks in 0.5 seconds, expands in 0.5 seconds, and maps distance to 1×–2× damage', () => {
  const timing = new AttackTiming(settings)
  assert.equal(settings.halfCycleMs, 500)
  timing.begin('melee')
  assert.equal(timing.radiusRatio, 1)
  assert.equal(timing.damageMultiplier, 1)
  timing.update(250)
  assert.equal(timing.radiusRatio, 0.5)
  assert.equal(timing.damageMultiplier, 1.5)
  timing.update(250)
  assert.equal(timing.radiusRatio, 0)
  assert.equal(timing.damageMultiplier, 2)
  timing.update(250)
  assert.equal(timing.damageMultiplier, 1.5)
  timing.update(250)
  assert.equal(timing.damageMultiplier, 1)
  timing.update(1500)
  assert.deepEqual(timing.release(), { kind: 'melee', multiplier: 2 })
})

test('preparation cannot be reset by repeated presses; release resolves once and cancellation does not attack', () => {
  const timing = new AttackTiming(settings)
  assert.equal(timing.release(), undefined)
  assert.equal(timing.begin('shot'), true)
  timing.update(500)
  assert.equal(timing.begin('melee'), false)
  assert.deepEqual(timing.release(), { kind: 'shot', multiplier: 2 })
  assert.equal(timing.release(), undefined)
  timing.begin('melee'); timing.update(400); timing.cancel()
  assert.equal(timing.active, false)
  assert.equal(timing.release(), undefined)
  timing.begin('shot')
  assert.equal(timing.damageMultiplier, 1, 'a new attack starts at the widest ring')
})

test('gameplay time advances consistently across frame sizes and ignores negative or invalid deltas', () => {
  const whole = new AttackTiming(settings), steps = new AttackTiming(settings)
  whole.begin('melee'); steps.begin('melee')
  whole.update(350)
  for (let frame = 0; frame < 7; frame++) steps.update(50)
  assert.equal(steps.damageMultiplier, whole.damageMultiplier)
  steps.update(-100); steps.update(NaN); steps.update(Infinity)
  assert.equal(steps.damageMultiplier, whole.damageMultiplier)
  whole.cancel(); whole.update(1000)
  assert.equal(whole.active, false)
})

test('authored attack groups preserve two preparation sprites and remaining attack sprites with strict timing config', () => {
  const { hero } = content()
  for (const kind of ['fight', 'shoot']) {
    const prep = hero.steps[hero.actions[`${kind}Prepare`]], attack = hero.steps[hero.actions[kind]]
    assert.equal(prep.length, 2)
    assert.equal(attack.length, 4)
    assert.ok(prep[1].x < attack[0].x, 'attack continues after the preparation crops')
  }
  for (const patch of [
    hero => { hero.settings.attackTiming.halfCycleMs = 0 },
    hero => { hero.settings.attackTiming.maxDamageMultiplier = 0.5 },
    hero => { hero.settings.attackTiming.dotRadius = hero.settings.attackTiming.radius },
    hero => { hero.steps[hero.actions.fightPrepare].pop() },
    hero => { hero.animations[hero.actions.shootPrepare].repeat = -1 },
  ]) {
    const { data, sources } = catalogue(); patch(data.hero)
    assert.throws(() => validateContent(data, sources), /src\/content\/hero\//)
  }
})
