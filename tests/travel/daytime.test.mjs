import assert from 'node:assert/strict'
import test from 'node:test'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { TravelService } from '../../src/app/services/world/TravelService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { content } from '../helpers/content.mjs'

// Timing scenarios start in Center so the first Factory trip changes districts.
const locations = content().locations.sort((a, b) => Number(b.id === 'center') - Number(a.id === 'center'))

test('four phases cycle in order and a new morning starts the next day', () => {
  const time = new DayTimeService()
  assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 1, phase: 'morning' })
  for (const phase of ['afternoon', 'evening', 'night']) {
    time.advance()
    assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 1, phase })
  }
  time.advance()
  assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 2, phase: 'morning' })
  const custom = new DayTimeService(7, 'night')
  custom.advance()
  assert.deepEqual((({ day, phase }) => ({ day, phase }))(custom.getSnapshot()), { day: 8, phase: 'morning' })
})

test('bus trips preserve time including invalid and same-location trips', () => {
  const time = new DayTimeService()
  const travel = new TravelService(locations, time)
  const initial = time.getSnapshot()
  travel.travelTo('factory')
  travel.openTravel()
  travel.travelTo('missing-location')
  travel.closeTravel()
  travel.openTravel()
  travel.travelTo('center')
  assert.equal(time.getSnapshot(), initial)
  travel.subscribe(() => {
    if (travel.getSnapshot().currentLocationId === 'living-district' && travel.getSnapshot().journey >= 4) {
      assert.equal(time.getSnapshot().phase, 'morning')
    }
  })
  travel.openTravel()
  travel.travelTo('factory')
  assert.equal(time.getSnapshot(), initial)
  travel.openTravel()
  travel.travelTo('factory')
  travel.openTravel()
  travel.travelTo('missing-location')
  travel.openTravel()
  travel.travelTo('living-district')
  assert.equal(time.getSnapshot().phase, 'morning')
})

test('buses preserve time for every interval; night takes three walking trips', () => {
  for (const interval of [1, 2, 3]) {
    const time = new DayTimeService()
    const travel = new TravelService(locations, time, interval)
    for (let count = 1; count <= interval * 3; count++) {
      travel.openTravel()
      travel.travelTo(count % 2 ? 'factory' : 'living-district')
      assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), {
        day: 1,
        phase: 'morning',
      })
    }
    time.advance(); time.advance(); time.advance()
    travel.openTravel()
    assert.equal(travel.getSnapshot().menuOpen, false)
    for (let trip = 0; trip < 3; trip++) {
      const location = travel.getSnapshot().locations.find(entry => entry.id === travel.getSnapshot().currentLocationId)
      const direction = location.connections.right ? 'right' : 'left'
      assert.equal(travel.openTravel('walk', direction), true)
      travel.travelTo(location.connections[direction])
      assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), trip < 2 ? { day: 1, phase: 'night' } : { day: 2, phase: 'morning' })
    }
    assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 2, phase: 'morning' })
  }
})

test('time snapshots publish once per advance and subscriptions can be released', () => {
  const time = new DayTimeService()
  const initial = time.getSnapshot()
  let count = 0
  const unsubscribe = time.subscribe(() => count++)
  assert.equal(time.getSnapshot(), initial)
  time.advance()
  assert.notEqual(time.getSnapshot(), initial)
  assert.equal(count, 1)
  unsubscribe()
  time.advance()
  assert.equal(count, 1)
})

test('night travel progress survives restore and clears when rest skips the remaining night', () => {
  const locations = [{ id: 'a', connections: { right: 'b' } }, { id: 'b', connections: { left: 'a' } }]
  const time = new DayTimeService(1, 'night')
  const travel = new TravelService(locations, time)
  travel.openTravel('walk', 'right'); travel.travelTo('b')
  const saved = travel.saveState()
  const restored = new TravelService(locations, time)
  restored.restoreState(saved)
  restored.openTravel('walk', 'left'); restored.travelTo('a')
  assert.equal(time.getSnapshot().phase, 'night')
  time.advance()
  assert.equal(restored.saveState().phaseTravels, 0)
  restored.openTravel('walk', 'right'); restored.travelTo('b')
  assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 2, phase: 'afternoon' })
})

test('daytime JSON rejects unknown phases, invalid opacity and overflowing icon crops', () => {
  const cases = [
    [config => { config.initialPhaseTravels = -1 }, /daytime.json.initialPhaseTravels/],
    [config => { config.initialPhaseTravels = config.travelsPerPhase * config.nightDurationMultiplier }, /daytime.json.initialPhaseTravels/],
    [config => { config.travelsPerPhase = 0 }, /daytime.json.travelsPerPhase/],
    [config => { config.travelsPerPhase = 1.5 }, /daytime.json.travelsPerPhase/],
    [config => { config.nightDurationMultiplier = 0 }, /daytime.json.nightDurationMultiplier/],
    [config => { config.nightDurationMultiplier = 1.5 }, /daytime.json.nightDurationMultiplier/],
    [config => { config.initialPhase = 'dawn' }, /daytime.json.initialPhase/],
    [config => { config.phases.night.filter.alpha = 1.1 }, /daytime.json.phases.night.filter.alpha/],
    [config => { config.phases.morning.icon.x = 9999 }, /daytime.json.phases.morning.icon: crop exceeds/],
  ]
  for (const [mutate, pattern] of cases) {
    const data = content()
    mutate(data.daytime)
    assert.throws(() => validateContent(data), pattern)
  }
})

test('late-night opening reaches Center the next morning only after confirmed walking', () => {
  const data = content()
  const config = data.daytime
  const time = new DayTimeService(config.initialDay, config.initialPhase)
  const travel = new TravelService(data.locations, time, config.travelsPerPhase, undefined, config.nightDurationMultiplier)
  travel.restoreState({ locationId: config.initialLocationId, phaseTravels: config.initialPhaseTravels })
  assert.equal(travel.getSnapshot().currentLocationId, 'factory')
  assert.equal(time.getSnapshot().phase, 'night')
  assert.equal(travel.openTravel('bus'), false)
  travel.openTravel('walk', 'right')
  travel.closeTravel()
  assert.equal(time.getSnapshot().phase, 'night')
  assert.equal(travel.saveState().phaseTravels, config.initialPhaseTravels)
  travel.openTravel('walk', 'right')
  travel.travelTo('center')
  assert.equal(travel.getSnapshot().currentLocationId, 'center')
  assert.equal(time.getSnapshot().day, config.initialDay + 1)
  assert.equal(time.getSnapshot().phase, 'morning')
  assert.equal(travel.saveState().phaseTravels, 0)
  travel.travelTo('center')
  assert.equal(time.getSnapshot().phase, 'morning')
})
