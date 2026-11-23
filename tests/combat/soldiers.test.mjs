import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { content } from '../helpers/content.mjs'
import { resolveOutdoorPatrols } from '../../src/app/content/resolveOutdoorPatrols.ts'
import { nearestPatrolEnemy } from '../../src/domain/combat/patrolEnemies.ts'
import { patrolAttackKind, PatrolCombat } from '../../src/domain/combat/patrolCombat.ts'

const config = content().patrols
const populations = (day, phase) => Object.keys(config.locations).flatMap(id =>
  resolveOutdoorPatrols(config, id, phase, day).map(entry => ({ ...entry, id })))

test('global human totals remain exact through repeated visits, phases and day rollover', () => {
  for (let day = 1; day <= 100; day++) for (const phase of ['morning', 'afternoon', 'evening', 'night']) {
    const entries = populations(day, phase)
    const total = type => entries.filter(entry => entry.definition === config.types[type]).reduce((sum, entry) => sum + entry.count, 0)
    const factoryHumans = entries.some(entry => entry.id === 'factory' && entry.definition.kind === 'human')
    assert.equal(total('solider'), phase !== 'night' ? 6 : factoryHumans ? 5 : 4)
    assert.equal(total('patrol'), phase !== 'night' || factoryHumans ? 3 : 2)
    {
      for (const [id, soldiers, militia] of [['factory', phase !== 'night' ? 2 : factoryHumans ? 1 : 0, phase !== 'night' || factoryHumans ? 1 : 0], ['center', 2, 1], ['living-district', 2, 1]]) {
        const districtTotal = type => entries.filter(entry => entry.id === id && entry.definition === config.types[type])
          .reduce((sum, entry) => sum + entry.count, 0)
        assert.equal(districtTotal('solider'), soldiers)
        assert.equal(districtTotal('patrol'), militia)
      }
    }
    assert.deepEqual(populations(day, phase), entries)
    assert.equal(total('titan'), phase === 'night' ? 1 : 0)
    for (const entry of entries.filter(entry => entry.definition.kind === 'monster')) {
      assert.equal(phase, 'night')
      if (entry.definition === config.types.titan) assert.equal(entry.id, 'factory')
      if (entry.definition === config.types.fly) assert.notEqual(entry.id, 'factory')
      if (entry.definition === config.types.octopus) assert.equal(entry.count, 3)
    }
  }
  assert.notDeepEqual(populations(1, 'night'), populations(2, 'night'))
})

test('soldiers swap damage modes and shoot without being hit first', () => {
  const militia = config.types.patrol.combat, soldier = config.types.solider.combat
  assert.equal(militia.health, 100)
  assert.equal(militia.meleeDamage, 15)
  assert.equal(militia.ranged.damage, 20)
  assert.equal(soldier.health, 150)
  assert.equal(soldier.meleeDamage, 23)
  assert.equal(soldier.ranged.damage, 30)
  assert.equal(patrolAttackKind(soldier, 300, false), 'shot')
  assert.equal(patrolAttackKind(soldier, 20, false), 'shot')
  assert.equal(patrolAttackKind(militia, 300, false), undefined)
  assert.equal(patrolAttackKind(soldier, soldier.ranged.range + 1, false), undefined)
  assert.equal(patrolAttackKind(soldier, 300, false, soldier.ranged.heightTolerance + 1), undefined)
  const combat = new PatrolCombat(soldier)
  combat.engage()
  assert.equal(combat.update(soldier.reactionDelayMs, true, true, 'shot'), 30)
  assert.equal(combat.finishAttack(true, true), 30)
  assert.equal(combat.finishAttack(true, true), 0)
})

test('soldier animation crops fit the existing atlas and nighttime rolls use the requested probabilities', () => {
  const soldier = config.types.solider
  const png = readFileSync(new URL(`../../public/${soldier.path}`, import.meta.url))
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
  assert.equal(soldier.referenceWidth, width)
  for (const frames of [soldier.idleSteps, ...['walk', 'run', 'attack', 'shoot', 'death'].map(action => soldier[action].steps)]) {
    for (const frame of frames) {
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= width && frame.y + frame.height <= height)
    }
  }
  assert.equal(config.locations.center.outdoorSpawns.find(entry => entry.type === 'fly').chance, 0.5)
  for (const location of [config.locations.center, config.locations['living-district']]) {
    assert.equal(location.outdoorSpawns.find(entry => entry.type === 'octopus').chance, 0.5)
  }
})

test('opposing patrol factions select living visible enemies in range and ignore allies', () => {
  const actor = (kind, x, overrides = {}) => ({ kind, health: 100, detectionRadius: 100,
    sprite: { x, y: 0, active: true, visible: true }, ...overrides })
  const human = actor('human', 0), ally = actor('human', 5), monster = actor('monster', 100)
  assert.equal(nearestPatrolEnemy(human, [ally, monster]), monster)
  assert.equal(nearestPatrolEnemy(monster, [human]), human)
  assert.equal(nearestPatrolEnemy(human, [ally, actor('monster', 101), actor('monster', 5, { health: 0 })]), undefined)
  monster.sprite.visible = false
  assert.equal(nearestPatrolEnemy(human, [monster]), undefined)
  monster.sprite.visible = true; monster.sprite.active = false
  assert.equal(nearestPatrolEnemy(human, [monster]), undefined)
})
