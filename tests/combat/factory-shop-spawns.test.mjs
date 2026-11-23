import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { resolveEmptyInteriorSpawns } from '../../src/app/content/resolvePatrolPopulation.ts'

const data = content()

/** Describe a roomless interior using the real building placement ID. */
function space(buildingId) {
  return { buildingId, floor: 0, groundY: 500, clearance: 200,
    bounds: { left: 0, right: 1000 } }
}

for (const [location, building] of [['factory', 'factory-main'], ['center', 'center-shop']]) {
  test(`${building} rolls one Octopus or Fly at night with a total 30% chance`, () => {
    for (const [choice, type] of [[0, 'octopus'], [0.499, 'octopus'], [0.5, 'fly'], [0.999, 'fly']]) {
      const rolls = [0.299, choice]
      const result = resolveEmptyInteriorSpawns(data.patrols, location, 'night',
        [space(building)], [], () => rolls.shift())
      assert.equal(result.length, 1)
      assert.equal(result[0].definition, data.patrols.types[type])
    }
    assert.deepEqual(resolveEmptyInteriorSpawns(data.patrols, location, 'night',
      [space(building)], [], () => 0.3), [])
    for (const phase of ['morning', 'afternoon', 'evening']) {
      assert.deepEqual(resolveEmptyInteriorSpawns(data.patrols, location, phase,
        [space(building)], [], () => { throw Error('daytime roll') }), [])
    }
  })

  test(`${building} stays safe while occupied by an NPC or the hero`, () => {
    const noRoll = () => { throw Error('occupied interior roll') }
    assert.deepEqual(resolveEmptyInteriorSpawns(data.patrols, location, 'night',
      [space(building)], [{ buildingId: building }], noRoll), [])
    assert.deepEqual(resolveEmptyInteriorSpawns(data.patrols, location, 'night',
      [space(building)], [], noRoll, { buildingId: building }), [])
  })
}

test('interior spawn overrides reject unknown buildings, invalid chances and non-monsters', () => {
  for (const patch of [
    entry => { entry.buildingId = 'missing' },
    entry => { entry.chance = 1.1 },
    entry => { entry.types = [] },
    entry => { entry.types = ['missing'] },
    entry => { entry.types = ['patrol'] },
  ]) {
    const changed = content()
    patch(changed.patrols.locations.factory.emptyInteriorSpawn.buildings[0])
    assert.throws(() => validateContent(changed), /emptyInteriorSpawn.buildings/)
  }
})
