import assert from 'node:assert/strict'
import test from 'node:test'
import { detectsHero, PatrolCombat } from '../../src/domain/combat/patrolCombat.ts'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

const definition = content().patrols.types.patrol

test('night detection uses a circle around the available hero, including the radius boundary', () => {
  const target = { x: 100, y: 200, available: true }, radius = definition.combat.detectionRadius
  assert.equal(detectsHero({ x: target.x + radius, y: 200 }, target, radius, true), true)
  assert.equal(detectsHero({ x: target.x + radius + 1, y: 200 }, target, radius, true), false)
  assert.equal(detectsHero({ x: target.x + radius, y: target.y + radius }, target, radius, true), false)
  assert.equal(detectsHero({ x: 100, y: 200 }, target, radius, false), false)
  assert.equal(detectsHero({ x: 100, y: 200 }, { ...target, available: false }, radius, true), false)
})

test('detection starts combat without damage, and losing detection cancels a pending attack', () => {
  const combat = new PatrolCombat(definition.combat)
  combat.engage()
  assert.equal(combat.health, definition.combat.health)
  assert.equal(combat.aggressive, true)
  assert.equal(combat.update(definition.combat.reactionDelayMs - 1, true, true), 0)
  assert.ok(combat.update(1, true, true) > 0)
  combat.disengage()
  assert.equal(combat.aggressive, false)
  assert.equal(combat.finishAttack(true, true), 0)
  combat.receiveDamage(999)
  combat.engage()
  assert.equal(combat.update(9999, true, true), 0)
})

test('daytime patrols join an active fight only inside detection range and when the hero is available', () => {
  const target = { x: 100, y: 200, available: true }
  const radius = definition.combat.detectionRadius
  assert.equal(detectsHero({ x: 100, y: 200 }, target, radius, false, false), false)
  assert.equal(detectsHero({ x: 100 + radius, y: 200 }, target, radius, false, true), true)
  assert.equal(detectsHero({ x: 101 + radius, y: 200 }, target, radius, false, true), false)
  assert.equal(detectsHero({ x: 100 + radius, y: 200 + radius }, target, radius, false, true), false)
  assert.equal(detectsHero({ x: 100, y: 200 }, { ...target, available: false }, radius, false, true), false)
  assert.equal(detectsHero({ x: 100 + radius / 2 + 1, y: 200 }, target, radius / 2, false, true), false, 'skill-adjusted detection radius still applies')
  const patrol = new PatrolCombat(definition.combat)
  if (detectsHero({ x: 100, y: 200 }, target, radius, false, true)) patrol.engage()
  assert.equal(patrol.aggressive, true)
  patrol.receiveDamage(99999)
  patrol.engage()
  assert.equal(patrol.update(9999, true, true), 0, 'dead patrols cannot attack after detection')
})

test('patrol run frames are authored in the run row and invalid detection config is rejected', () => {
  assert.equal(definition.run.steps.length, 7)
  assert.notEqual(definition.run.key, definition.walk.key)
  for (const frame of definition.run.steps) {
    assert.ok(frame.y >= 240 && frame.y + frame.height <= 440)
    assert.ok(frame.x + frame.width <= definition.referenceWidth)
  }
  const input = content()
  input.patrols.types.patrol.combat.detectionRadius = -1
  assert.throws(() => validateContent(input), /detectionRadius/)
})
