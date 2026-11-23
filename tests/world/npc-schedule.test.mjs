import assert from 'node:assert/strict'
import test from 'node:test'
import { DAY_PHASES } from '../../src/app/contracts/daytime.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { TravelService } from '../../src/app/services/world/TravelService.ts'
import { resolveNpcPlacements } from '../../src/app/content/resolveNpcPlacements.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, content } from '../helpers/content.mjs'

// Keep fallback/override fixtures independent of newly authored residents.
function originalRoster() {
  const data = content()
  data.npcs = Object.fromEntries(['stranger', 'worker', 'cashier', 'bartender'].map(id => [id, data.npcs[id]]))
  return data
}

test('each authored schedule places each character once per phase in its configured district', () => {
  const { npcs, locations } = content()
  for (const phase of DAY_PHASES) {
    const roster = locations.flatMap(location => resolveNpcPlacements(npcs, locations, location.id, phase)
      .map(placement => ({ ...placement, locationId: location.id })))
    assert.equal(new Set(roster.map(placement => placement.type)).size, roster.length)
    for (const placement of roster) {
      const home = locations.find(location => location.npc?.type === placement.type)
      const expected = npcs[placement.type].schedule?.[phase] ?? { ...home.npc, locationId: home.id }
      assert.notEqual(expected.enabled, false)
      assert.equal(placement.locationId, expected.locationId)
      assert.equal(placement.x, expected.x)
    }
  }
})

test('a missing phase or schedule uses the original location placement', () => {
  const { npcs, locations } = originalRoster()
  delete npcs.cashier
  delete npcs.bartender
  delete npcs.stranger.schedule.afternoon
  assert.deepEqual(resolveNpcPlacements(npcs, locations, 'living-district', 'afternoon'),
    [{ type: 'stranger', x: 210, scale: 1 }])
  assert.deepEqual(resolveNpcPlacements(npcs, locations, 'center', 'afternoon'), [])
  delete npcs.worker.schedule
  assert.deepEqual(resolveNpcPlacements(npcs, locations, 'factory', 'night'),
    [{ type: 'worker', x: 1196, scale: 1 }])
})

test('a disabled phase hides its NPC and disabling the home placement disables its schedule', () => {
  const { npcs, locations } = originalRoster()
  delete npcs.cashier
  delete npcs.bartender
  npcs.stranger.schedule.morning.enabled = false
  assert.ok(resolveNpcPlacements(npcs, locations, 'living-district', 'morning').every(npc => npc.type !== 'stranger'))
  locations.find(location => location.id === 'factory').npc.enabled = false
  assert.deepEqual(resolveNpcPlacements(npcs, locations, 'center', 'evening'), [])
})

test('multiple NPCs can share a district; phase scale overrides the home placement scale', () => {
  const { npcs, locations } = originalRoster()
  locations[0].npc.scale = 1.4
  npcs.worker.schedule.morning = { locationId: 'living-district', x: 720, scale: 0.8 }
  assert.deepEqual(resolveNpcPlacements(npcs, locations, 'living-district', 'morning'), [
    { type: 'stranger', x: 210, scale: 1.4 }, { type: 'worker', x: 720, scale: 0.8 },
  ])
  delete locations[0].npc
  assert.ok(resolveNpcPlacements(npcs, locations, 'living-district', 'morning').some(npc => npc.type === 'stranger'))
})

test('arrival resolves the new time before spawning characters', () => {
  const { npcs, locations } = originalRoster()
  npcs.worker.schedule = {
    afternoon: { locationId: 'factory', x: 1520 },
    evening: { locationId: 'center', x: 1800 },
    night: { locationId: 'living-district', x: 720 },
  }
  const time = new DayTimeService()
  const travel = new TravelService(locations, time)
  const expected = [['factory', 'afternoon', 1520], ['center', 'evening', 1800], ['living-district', 'night', 720]]
  for (const [destination, phase, x] of expected) {
    const intermediate = locations.find(location => location.id !== destination && location.id !== travel.getSnapshot().currentLocationId)
    for (const stop of [intermediate.id, destination]) {
      travel.openTravel()
      travel.travelTo(stop)
    }
    assert.equal(time.getSnapshot().phase, phase)
    const roster = resolveNpcPlacements(npcs, locations, destination, time.getSnapshot().phase)
    assert.equal(roster.find(npc => npc.type === 'worker').x, x)
  }
})

test('invalid schedule entries report the NPC file and phase', () => {
  const cases = [
    [npc => { npc.schedule.morning.locationId = 'missing' }, /schedule.morning.locationId: unknown location/],
    [npc => { npc.schedule.morning.x = -1 }, /schedule.morning.x/],
    [npc => { npc.schedule.morning.scale = 0 }, /schedule.morning.scale/],
    [npc => { npc.schedule.mornign = npc.schedule.morning }, /schedule.mornign: unknown configuration field/],
  ]
  for (const [mutate, pattern] of cases) {
    const { data, sources } = catalogue()
    mutate(data.npcs.stranger)
    assert.throws(() => validateContent(data, sources), error => {
      assert.match(error.message, /src\/content\/npc\/stranger.json/)
      assert.match(error.message, pattern)
      return true
    })
  }
})

test('shop and bar staff work indoors during the day and all residents have distinct left apartments at night', () => {
  const { npcs, locations, buildings } = originalRoster()
  for (const phase of ['morning', 'afternoon', 'evening']) {
    const roster = resolveNpcPlacements(npcs, locations, 'center', phase)
    for (const [type, buildingId] of [['cashier', 'center-shop'], ['bartender', 'center-bar']]) {
      const npc = roster.find(npc => npc.type === type)
      assert.equal(npc.buildingId, buildingId)
      assert.equal(npc.roomId, undefined)
    }
  }
  const residents = resolveNpcPlacements(npcs, locations, 'living-district', 'night')
  assert.equal(residents.length, Object.keys(npcs).length)
  assert.equal(new Set(residents.map(npc => npc.roomId)).size, residents.length)
  for (const npc of residents) {
    assert.equal(npc.buildingId, 'apartments')
    assert.notEqual(npc.roomId, 'apartment-21')
    const room = buildings.house.rooms.find(room => room.id === npc.roomId)
    assert.ok(room)
    assert.equal(room.x, 192)
  }
  assert.deepEqual(resolveNpcPlacements(npcs, locations, 'center', 'night'), [])
  assert.deepEqual(resolveNpcPlacements(npcs, locations, 'factory', 'night'), [])
})

test('interior schedules reject invalid buildings, rooms, floors and local positions', () => {
  for (const [patch, pattern] of [
    [{ buildingId: 'missing' }, /buildingId: unknown building/],
    [{ roomId: 'missing' }, /roomId: unknown room/],
    [{ floor: 99 }, /room determines its floor/],
    [{ x: 9999 }, /x: outside the walkable interior/],
    [{ buildingId: undefined }, /room\/floor requires a buildingId/],
  ]) {
    const { data, sources } = catalogue()
    Object.assign(data.npcs.stranger.schedule.night, patch)
    assert.throws(() => validateContent(data, sources), pattern)
  }
})
