import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { resolveNpcPlacements } from '../../src/app/content/resolveNpcPlacements.ts'

test('clerk and caretaker visit their configured daytime districts and keep night rooms', () => {
  const { npcs, locations } = content()
  for (const [id, districts, room] of [
    ['citizen-clerk', ['center', 'factory', 'living-district'], 'apartment-32'],
    ['citizen-caretaker', ['living-district', 'factory', 'center'], 'apartment-42'],
  ]) {
    for (const [index, phase] of ['morning', 'afternoon', 'evening'].entries()) {
      const roster = locations.flatMap(location => resolveNpcPlacements(npcs, locations, location.id, phase)
        .filter(npc => npc.type === id).map(npc => location.id))
      assert.deepEqual(roster, [districts[index]])
    }
    assert.equal(resolveNpcPlacements(npcs, locations, 'living-district', 'night')
      .find(npc => npc.type === id).roomId, room)
  }
})

test('bar, shop, barracks and apartment hall each provide a ground-floor rest chair', () => {
  const { furniture } = content()
  for (const building of ['center-bar', 'center-shop', 'living-barracks', 'apartments']) {
    const chair = furniture.placements.find(placement => placement.id === `${building}-chair`)
    assert.equal(chair.buildingId, building)
    assert.equal(chair.floor, 0)
    assert.equal(chair.space, 'inside')
    assert.equal(furniture.types[chair.type].action, 'rest')
  }
})
