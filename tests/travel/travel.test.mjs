import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import test from 'node:test'
import { TravelService } from '../../src/app/services/world/TravelService.ts'

const locations = content().locations.sort((a, b) => Number(b.id === 'center') - Number(a.id === 'center'))

test('all locations have distinct backgrounds, buildings, and reachable bus-stop spawns', () => {
  assert.ok(locations.length > 0)
  assert.equal(new Set(locations.map(location => location.id)).size, locations.length)
  for (const location of locations) {
    assert.ok(location.busStop.spawnOffset < location.busStop.interactionRadius)
    assert.ok(location.buildings.length > 0)
    for (const building of location.buildings) assert.ok(Math.abs(building.entranceX - location.busStop.x) > location.busStop.interactionRadius)
  }
  assert.equal(locations[1].buildings[0].type, 'factory')
  assert.equal(locations[1].npc.type, 'worker')
  assert.ok(Math.abs(locations[1].npc.x - locations[1].buildings[0].entranceX) <= 120)
})

test('Center has a central bus stop with the bar on its left and shop on its right', () => {
  const center = locations.find(location => location.id === 'center')
  assert.equal(center.busStop.x, 1440)
  const bar = center.buildings.find(building => building.type === 'bar')
  const shop = center.buildings.find(building => building.type === 'shop')
  assert.ok(bar.entranceX < center.busStop.x)
  assert.ok(shop.entranceX > center.busStop.x)
  const travel = new TravelService(locations)
  for (const destination of ['center', 'factory', 'living-district']) {
    travel.openTravel()
    travel.travelTo(destination)
    assert.equal(travel.getSnapshot().currentLocationId, destination)
    assert.equal(travel.getSnapshot().menuOpen, false)
  }
})

test('travelling between both districts updates the current destination and requests fresh arrivals', () => {
  const travel = new TravelService(locations)
  travel.openTravel()
  travel.travelTo('factory')
  assert.equal(travel.getSnapshot().currentLocationId, 'factory')
  assert.equal(travel.getSnapshot().journey, 1)
  assert.equal(travel.getSnapshot().menuOpen, false)
  travel.openTravel()
  travel.travelTo('living-district')
  assert.equal(travel.getSnapshot().currentLocationId, 'living-district')
  assert.equal(travel.getSnapshot().journey, 2)
})

test('opening and closing publish stable snapshots only when state changes', () => {
  const travel = new TravelService(locations)
  const initial = travel.getSnapshot()
  let notifications = 0
  const unsubscribe = travel.subscribe(() => { notifications++ })
  travel.closeTravel()
  assert.equal(travel.getSnapshot(), initial)
  travel.openTravel()
  const open = travel.getSnapshot()
  travel.openTravel()
  assert.equal(travel.getSnapshot(), open)
  assert.equal(open.menuOpen, true)
  travel.closeTravel()
  assert.equal(travel.getSnapshot().menuOpen, false)
  assert.equal(notifications, 2)
  unsubscribe()
  travel.openTravel()
  assert.equal(notifications, 2)
})

test('travel requires an open menu and a known destination', () => {
  const travel = new TravelService(locations)
  travel.travelTo(locations[0].id)
  assert.equal(travel.getSnapshot().journey, 0)
  travel.openTravel()
  travel.travelTo('missing-district')
  assert.equal(travel.getSnapshot().menuOpen, true)
  assert.equal(travel.getSnapshot().journey, 0)
})

test('choosing the current district closes the menu and requests a fresh arrival', () => {
  const travel = new TravelService(locations)
  travel.openTravel()
  travel.travelTo(locations[0].id)
  assert.equal(travel.getSnapshot().menuOpen, false)
  assert.equal(travel.getSnapshot().currentLocationId, locations[0].id)
  assert.equal(travel.getSnapshot().journey, 1)
  travel.openTravel()
  travel.travelTo(locations[0].id)
  assert.equal(travel.getSnapshot().journey, 2)
})

test('an empty catalogue is rejected before a scene can start', () => {
  assert.throws(() => new TravelService([]), /At least one/)
})
