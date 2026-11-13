import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { patrolAttackKind, PatrolCombat } from '../../src/domain/combat/patrolCombat.ts'
import { patrolDifficulty } from '../../src/domain/character/difficulty.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

const officer = content().patrols.types.patrol
const settings = officer.combat

test('officers only shoot after being hit, while detection alone permits melee and pursuit', () => {
  assert.equal(patrolAttackKind(settings, settings.meleeRange, false), 'melee')
  assert.equal(patrolAttackKind(settings, settings.meleeRange + 1, false), undefined)
  assert.equal(patrolAttackKind(settings, -settings.ranged.range, false), undefined)
  assert.equal(patrolAttackKind(settings, -settings.ranged.range, true), 'shot')
  assert.equal(patrolAttackKind(settings, settings.ranged.range + 1, true), undefined)
  assert.equal(patrolAttackKind(settings, 10, true), 'shot')
  const monster = { meleeRange: 60, levelTolerance: 20 }
  assert.equal(patrolAttackKind(monster, 10, true), 'melee')
  assert.equal(patrolAttackKind(monster, 61, true), undefined)
})

test('provoked officers can shoot low props but higher ground prevents shots and elevated melee', () => {
  assert.equal(patrolAttackKind(settings, 100, true, 95), 'shot')
  assert.equal(patrolAttackKind(settings, 100, true, settings.ranged.heightTolerance), 'shot')
  assert.equal(patrolAttackKind(settings, 100, true, settings.ranged.heightTolerance + 1), undefined)
  assert.equal(patrolAttackKind(settings, 100, true, -95), 'shot')
  assert.equal(patrolAttackKind(settings, 10, false, 95), undefined)
  assert.equal(patrolAttackKind(settings, 10, false, settings.levelTolerance), 'melee')
  assert.equal(patrolAttackKind(settings, 10, false, settings.levelTolerance + 1), undefined)
  const combat = new PatrolCombat(settings)
  combat.receiveDamage(1)
  assert.equal(combat.update(settings.reactionDelayMs, true, true, 'shot'), settings.ranged.damage)
  assert.equal(combat.finishAttack(patrolAttackKind(settings, 100, true, 150) === 'shot', true), 0)
  assert.equal(combat.finishAttack(true, true), 0, 'a shot dodged by reaching high ground cannot hit later')
})

test('shots respect reaction/cooldown, retain their damage through animation, and resolve once', () => {
  const combat = new PatrolCombat(settings)
  combat.receiveDamage(1)
  assert.equal(combat.update(settings.reactionDelayMs - 1, true, true, 'shot'), 0)
  assert.equal(combat.update(1, true, true, 'shot'), settings.ranged.damage)
  assert.equal(combat.update(5000, true, true, 'melee'), 0, 'a swing cannot replace the pending shot')
  assert.equal(combat.finishAttack(true, true), settings.ranged.damage)
  assert.equal(combat.finishAttack(true, true), 0)
  assert.equal(combat.update(0, true, true), settings.meleeDamage)
  assert.equal(combat.finishAttack(true, true), settings.meleeDamage)
  assert.equal(combat.update(settings.attackCooldownMs - 1, true, true, 'shot'), 0)
  assert.equal(combat.update(1, true, true, 'shot'), settings.ranged.damage)
})

test('hidden, out-of-range, dead and cancelled targets take no pending shot damage', () => {
  for (const cancellation of ['hidden', 'range', 'death', 'context']) {
    const combat = new PatrolCombat(settings)
    combat.receiveDamage(1)
    assert.equal(combat.update(5000, true, false, 'shot'), 0, 'hidden targets do not advance retaliation')
    assert.equal(combat.update(settings.reactionDelayMs, true, true, 'shot'), settings.ranged.damage)
    if (cancellation === 'death') combat.receiveDamage(999)
    if (cancellation === 'context') combat.cancelAttack()
    assert.equal(combat.finishAttack(cancellation !== 'range', cancellation !== 'hidden'), 0)
    assert.equal(combat.finishAttack(true, true), 0)
  }
})

test('shooting damage follows patrol difficulty scaling without changing range', () => {
  const scaled = patrolDifficulty(settings, { modifiers: {
    patrolDamage: 1.5, patrolHealth: 1, patrolCooldown: 1, patrolReaction: 1, patrolSpeed: 1,
  } })
  assert.equal(scaled.ranged.damage, Math.round(settings.ranged.damage * 1.5))
  assert.equal(scaled.ranged.range, settings.ranged.range)
  assert.equal(settings.ranged.damage, 15)
})

test('officers retain original walking speed, double pursuit and detection, and six shooting poses', () => {
  assert.equal(officer.movement.speed, 55)
  assert.equal(officer.combat.chaseSpeed, 320)
  assert.equal(officer.combat.detectionRadius, 520)
  assert.equal(officer.walk.frameRate, 9)
  assert.equal(officer.run.frameRate, 24)
  assert.equal(officer.shoot.steps.length, 6)
  const png = readFileSync(new URL('../../public/assets/characters/npc/patrol.png', import.meta.url))
  const ratio = png.readUInt32BE(16) / officer.referenceWidth
  for (const frame of officer.shoot.steps) {
    assert.ok((frame.x + frame.width) * ratio <= png.readUInt32BE(16))
    assert.ok((frame.y + frame.height) * ratio <= png.readUInt32BE(20))
    assert.ok(frame.anchorX <= frame.width && frame.anchorY <= frame.height)
  }
})

test('ranged configuration requires matching art, a longer range and valid damage', () => {
  for (const mutate of [
    patrol => { delete patrol.shoot },
    patrol => { delete patrol.combat.ranged },
    patrol => { patrol.combat.ranged.range = patrol.combat.meleeRange },
    patrol => { patrol.combat.ranged.damage = 0 },
    patrol => { patrol.combat.ranged.heightTolerance = -1 },
    patrol => { patrol.combat.ranged.heightTolerance = patrol.combat.levelTolerance - 1 },
    patrol => { patrol.shoot.key = patrol.attack.key },
    patrol => { patrol.shoot.steps[0].anchorY = 999 },
  ]) {
    const { data, sources } = catalogue()
    mutate(data.patrols.types.patrol)
    assert.throws(() => validateContent(data, sources), /patrol/)
  }
})
