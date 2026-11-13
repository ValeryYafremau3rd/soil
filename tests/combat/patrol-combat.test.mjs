import assert from 'node:assert/strict'
import test from 'node:test'
import { closestPatrol, PatrolCombat } from '../../src/domain/combat/patrolCombat.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'
import { catalogue, content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

const settings = content().patrols.types.patrol.combat
const position = (x, y = 100) => ({ x, y, bounds: { left: x - 25, right: x + 25, top: y - 100, bottom: y } })
const patrol = (id, x, y = 100, extra = {}) => ({ id, ...position(x, y), health: 100, visible: true, ...extra })

test('melee requires collision and range, hits the closest patrol once, and ignores other levels', () => {
  const origin = position(100)
  const near = patrol('near', 125)
  const targets = [patrol('far', 145), near, patrol('other-floor', 101, 0), patrol('hidden', 102, 100, { visible: false })]
  assert.equal(closestPatrol(origin, targets, 'melee', 60, 20), near)
  assert.equal(closestPatrol(origin, [patrol('no-collision', 151)], 'melee', 60, 20), undefined)
  assert.equal(closestPatrol(origin, [patrol('out-of-range', 145)], 'melee', 30, 20), undefined)
})

test('shooting chooses the closest living visible patrol regardless of facing, skipping dead and other levels', () => {
  const near = patrol('behind', 20)
  const targets = [patrol('far', 400), near, patrol('dead', 101, 100, { health: 0 }), patrol('upstairs', 100, 0)]
  assert.equal(closestPatrol(position(100), targets, 'shot', 60, 20), near)
  assert.equal(closestPatrol(position(100), [], 'shot', 60, 20), undefined)
})

test('patrol health starts at 100, takes configured damage, clamps at zero, and stops retaliating when defeated', () => {
  const combat = new PatrolCombat(settings)
  const hero = content().hero.settings
  assert.equal(combat.health, 100)
  combat.receiveDamage(hero.meleeDamage)
  assert.equal(combat.health, 90)
  combat.receiveDamage(hero.shotDamage)
  assert.equal(combat.health, 75)
  combat.receiveDamage(999)
  assert.equal(combat.health, 0)
  assert.equal(combat.receiveDamage(20), false)
  assert.equal(combat.update(5000, true, true), 0)
})

test('patrols remain peaceful until hit, then respect reaction delay and one-second cooldown', () => {
  const combat = new PatrolCombat(settings)
  assert.equal(combat.update(5000, true, true), 0)
  combat.receiveDamage(20)
  assert.equal(combat.update(599, true, true), 0)
  assert.equal(combat.update(1, true, true), 20)
  assert.equal(combat.finishAttack(true, true), 20)
  assert.equal(combat.update(999, true, true), 0)
  assert.equal(combat.update(1, true, true), 20)
  assert.equal(combat.finishAttack(true, true), 20)
  assert.equal(combat.update(100000, true, true), 20, 'at most one attack in an update')
})

test('attack damage waits for completion, resolves once, and misses if the hero moves away or hides', () => {
  const combat = new PatrolCombat(settings)
  combat.receiveDamage(10)
  assert.equal(combat.finishAttack(true, true), 0, 'no hit before an attack starts')
  assert.equal(combat.update(600, true, true), 20)
  assert.equal(combat.update(5000, true, true), 0, 'cannot start another attack while completion is pending')
  assert.equal(combat.finishAttack(false, true), 0, 'moving away avoids the completed swing')
  assert.equal(combat.finishAttack(true, true), 0, 'a missed swing cannot hit later')
  assert.equal(combat.update(1000, true, true), 20)
  assert.equal(combat.finishAttack(true, false), 0, 'unavailable targets are protected')
  assert.equal(combat.update(1000, true, true), 20)
  assert.equal(combat.finishAttack(true, true), 20)
  assert.equal(combat.finishAttack(true, true), 0, 'completion can only deal damage once')
})

test('defeat or leaving the current context cancels a pending patrol hit', () => {
  for (const cancel of [combat => combat.receiveDamage(999), combat => combat.cancelAttack()]) {
    const combat = new PatrolCombat(settings)
    combat.receiveDamage(10)
    assert.equal(combat.update(600, true, true), 20)
    cancel(combat)
    assert.equal(combat.finishAttack(true, true), 0)
  }
})

test('hiding or pausing freezes retaliation; distant patrols wait for melee range', () => {
  const combat = new PatrolCombat(settings)
  combat.receiveDamage(20)
  assert.equal(combat.update(5000, true, false), 0)
  assert.equal(combat.update(599, true, true), 0)
  assert.equal(combat.update(1, false, true), 0)
  assert.equal(combat.update(0, true, true), 20)
})

test('repeated player attacks do not reset a patrol cooldown', () => {
  const combat = new PatrolCombat(settings)
  combat.receiveDamage(20)
  combat.update(400, true, true)
  combat.receiveDamage(20)
  assert.equal(combat.update(200, true, true), 20)
})

test('player damage updates health only, clamps at zero, and allows consumable recovery', () => {
  const status = new StatusService()
  status.takeDamage(10)
  assert.deepEqual(status.getSnapshot(), { health: 40, energy: 50, sanity: 50 })
  status.takeDamage(-10)
  status.takeDamage(NaN)
  assert.equal(status.getSnapshot().health, 40)
  status.takeDamage(1000)
  assert.equal(status.getSnapshot().health, 0)
  status.recover({ health: 25 })
  assert.equal(status.getSnapshot().health, 25)
})

test('combat configuration rejects invalid damage, health, ranges and cooldowns', () => {
  for (const [field, value] of [['health', 0], ['meleeDamage', -1], ['attackCooldownMs', 0], ['deathHoldMs', -1], ['chaseSpeed', -1], ['levelTolerance', -1]]) {
    const { data, sources } = catalogue()
    data.patrols.types.patrol.combat[field] = value
    assert.throws(() => validateContent(data, sources), /patrol.*combat/)
  }
  const { data, sources } = catalogue()
  data.hero.settings.shotDamage = 0
  assert.throws(() => validateContent(data, sources), /hero.*shotDamage/)
})

