import assert from 'node:assert/strict'
import test from 'node:test'
import { BoundaryTravel } from '../../src/game/interactive/BoundaryTravel.ts'
import { TravelService } from '../../src/app/services/TravelService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

// These edge scenarios begin at the eastern end of the route.
const locations = content().locations.sort((a, b) => Number(b.id === 'living-district') - Number(a.id === 'living-district'))

test('both outdoor boundaries open walking travel once until the hero leaves the edge', () => {
  const modes = []
  const edge = new BoundaryTravel({ openTravel: (mode, direction) => { modes.push([mode, direction]); return true } })
  const bounds = { left: 40, right: 2840 }
  assert.equal(edge.update(400, bounds), false)
  assert.equal(edge.update(40, bounds), true)
  assert.equal(edge.update(40, bounds), false)
  assert.equal(edge.update(41, bounds), false)
  assert.equal(edge.update(40, bounds), true)
  edge.update(500, bounds)
  assert.equal(edge.update(2840, bounds), true)
  assert.deepEqual(modes, [['walk', 'left'], ['walk', 'left'], ['walk', 'right']])
})

test('interior walls and disabled boundary checks do not open travel', () => {
  const modes = []
  const edge = new BoundaryTravel({ openTravel: mode => modes.push(mode) })
  assert.equal(edge.update(40, { left: 40, right: 500 }, false), false)
  assert.equal(edge.update(500, { left: 40, right: 500 }, false), false)
  assert.deepEqual(modes, [])
})

test('walking costs a full phase and preserves partial bus progress across day rollover', () => {
  const time = new DayTime()
  const travel = new TravelService(locations, time)
  const trips = [
    ['bus', 'factory', 1, 'morning'],
    ['walk', 'center', 1, 'afternoon'],
    ['bus', 'living-district', 1, 'evening'],
    ['walk', 'center', 1, 'night'],
    ['walk', 'factory', 1, 'night'],
    ['walk', 'center', 1, 'night'],
    ['walk', 'living-district', 2, 'morning'],
  ]
  for (const [mode, destination, day, phase] of trips) {
    const current = travel.getSnapshot().locations.find(location => location.id === travel.getSnapshot().currentLocationId)
    travel.openTravel(mode, current.connections?.right === destination ? 'right' : 'left')
    travel.travelTo(destination)
    assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day, phase })
  }
})

test('canceling, invalid destinations and choosing the current district do not charge walking time', () => {
  const time = new DayTime()
  const travel = new TravelService(locations, time)
  const initial = time.getSnapshot()
  travel.openTravel('walk')
  travel.closeTravel()
  travel.openTravel('walk')
  travel.travelTo('missing')
  travel.travelTo('living-district')
  assert.equal(time.getSnapshot(), initial)
  travel.closeTravel()
  travel.openTravel()
  assert.equal(travel.getSnapshot().mode, 'bus')
  travel.travelTo('factory')
  assert.equal(time.getSnapshot(), initial)
})

test('unconnected outer edges do nothing and connected edges only offer their configured neighbor', () => {
  const time = new DayTime()
  const travel = new TravelService(locations, time)
  const bounds = { left: 40, right: 2840 }
  const edge = new BoundaryTravel(travel)
  const initial = travel.getSnapshot()
  assert.equal(edge.update(bounds.right, bounds), false, 'Living District has no right route')
  assert.equal(travel.getSnapshot(), initial)
  edge.update(400, bounds)
  assert.equal(edge.update(bounds.left, bounds), true)
  assert.equal(travel.getSnapshot().destinationId, 'center')
  travel.travelTo('factory')
  assert.equal(travel.getSnapshot().currentLocationId, 'living-district', 'cannot bypass Center')
  travel.travelTo('center')
  assert.equal(travel.getSnapshot().currentLocationId, 'center')
  travel.openTravel('walk', 'left')
  assert.equal(travel.getSnapshot().destinationId, 'factory')
  travel.travelTo('factory')
  const atFactory = travel.getSnapshot()
  assert.equal(travel.openTravel('walk', 'left'), false)
  assert.equal(travel.getSnapshot(), atFactory, 'Factory has no left route')
  assert.equal(travel.openTravel('walk', 'right'), true)
  assert.equal(travel.getSnapshot().destinationId, 'center')
})

test('canceling an edge confirmation does not reopen until the hero leaves and reaches that edge again', () => {
  const time = new DayTime()
  const travel = new TravelService(locations, time)
  const edge = new BoundaryTravel(travel)
  const bounds = { left: 40, right: 2840 }
  const before = time.getSnapshot()
  edge.update(bounds.left, bounds)
  travel.closeTravel()
  assert.equal(edge.update(bounds.left, bounds), false)
  assert.equal(travel.getSnapshot().menuOpen, false)
  assert.equal(time.getSnapshot(), before)
  edge.update(100, bounds)
  assert.equal(edge.update(bounds.left, bounds), true)
  assert.equal(travel.getSnapshot().destinationId, 'center')
})

test('location connections validate known IDs, reject self-links, and require reciprocal edges', () => {
  for (const value of ['missing', 'factory', 'living-district']) {
    const data = content()
    data.locations.find(location => location.id === 'factory').connections.right = value
    assert.throws(() => validateContent(data), /connections/)
  }
})

test('walking arrives at the opposite connected edge, bus travel uses its stop, and load restores its own position', () => {
  const time = new DayTime()
  const travel = new TravelService(locations, time)
  assert.equal(travel.getSnapshot().arrivalEdge, null)
  travel.openTravel('walk', 'left')
  travel.closeTravel()
  assert.equal(travel.getSnapshot().arrivalEdge, null, 'canceling does not change arrival')
  travel.openTravel('walk', 'left')
  travel.travelTo('center')
  assert.equal(travel.getSnapshot().arrivalEdge, 'right', 'left from Living District enters Center on the right')
  travel.openTravel('walk', 'left')
  travel.travelTo('factory')
  assert.equal(travel.getSnapshot().arrivalEdge, 'right')
  travel.openTravel('walk', 'right')
  travel.travelTo('center')
  assert.equal(travel.getSnapshot().arrivalEdge, 'left', 'right from Factory enters Center on the left')
  travel.openTravel('walk', 'right')
  travel.travelTo('living-district')
  assert.equal(travel.getSnapshot().arrivalEdge, 'left')
  time.nextMorning()
  travel.openTravel()
  travel.travelTo('factory')
  assert.equal(travel.getSnapshot().arrivalEdge, null, 'bus arrivals clear the walking edge')
  travel.openTravel('walk', 'right')
  travel.travelTo('center')
  assert.equal(travel.getSnapshot().arrivalEdge, 'left')
  travel.restoreState(travel.saveState())
  assert.equal(travel.getSnapshot().arrivalEdge, null, 'load uses the saved hero position')
})
