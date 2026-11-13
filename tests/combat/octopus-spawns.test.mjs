import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveEmptyInteriorSpawns } from '../../src/app/content/resolvePatrolPopulation.ts'
import { content } from '../helpers/content.mjs'

const config = content().patrols
const space = (buildingId, floor = 0, roomId) => ({ buildingId, floor, roomId,
  groundY: 500, clearance: 200, bounds: { left: 0, right: 500 } })

test('night population refreshes exclude the hero room without excluding other empty rooms', () => {
  const spaces = [space('house', 0, 'bedroom'), space('house', 0, 'other'), space('neighbor', 0, 'bedroom')]
  const hero = { buildingId: 'house', roomId: 'bedroom' }
  for (let refresh = 0; refresh < 3; refresh++) {
    let rolls = 0
    const result = resolveEmptyInteriorSpawns(config, 'center', 'night', spaces, [], () => { rolls++; return 0 }, hero)
    assert.equal(rolls, 2)
    assert.deepEqual(result.map(entry => entry.space), spaces.slice(1))
  }
  assert.equal(resolveEmptyInteriorSpawns(config, 'center', 'night', spaces, [], () => 0).length, 3)
  assert.equal(resolveEmptyInteriorSpawns(config, 'center', 'night', spaces, [], () => 0,
    { buildingId: 'house' }).length, 3)
})

test('a hero in a roomless building prevents its roll, including on another floor', () => {
  const spaces = [space('house'), space('house', 1), space('neighbor')]
  let rolls = 0
  const result = resolveEmptyInteriorSpawns(config, 'center', 'night', spaces, [], () => { rolls++; return 0 },
    { buildingId: 'house' })
  assert.equal(rolls, 1)
  assert.deepEqual(result.map(entry => entry.space), [spaces[2]])
})

test('octopus rolls are nighttime only and use the exact ten-percent boundary', () => {
  for (const location of ['center', 'factory', 'living-district']) {
    assert.equal(config.locations[location].emptyInteriorSpawn.chance, 0.1)
    const resolve = (phase, random) => resolveEmptyInteriorSpawns(config, location, phase, [space('empty')], [], random)
    assert.equal(resolve('night', () => 0.099).length, 1)
    assert.equal(resolve('night', () => 0.1).length, 0)
    for (const phase of ['morning', 'afternoon', 'evening']) {
      assert.deepEqual(resolve(phase, () => { throw Error('daytime roll') }), [])
    }
  }
})

test('only empty rooms and roomless buildings roll, once each', () => {
  const spaces = [space('house'), space('house', 0, 'occupied'), space('house', 1, 'empty'),
    space('vacant'), space('vacant', 1), space('staffed')]
  const occupants = [{ buildingId: 'house', roomId: 'occupied' }, { buildingId: 'staffed' }]
  let rolls = 0
  const result = resolveEmptyInteriorSpawns(config, 'center', 'night', spaces, occupants, () => { rolls++; return 0 })
  assert.equal(rolls, 2)
  assert.deepEqual(result.map(entry => entry.space), [spaces[2], spaces[3]])
  assert.ok(result.every(entry => entry.definition.name === 'Octopus'))
  assert.deepEqual(resolveEmptyInteriorSpawns(config, 'missing', 'night', spaces, [], () => 0), [])
  const disabled = structuredClone(config)
  disabled.locations.center.enabled = false
  assert.deepEqual(resolveEmptyInteriorSpawns(disabled, 'center', 'night', spaces, [], () => 0), [])
})
