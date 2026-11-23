import assert from 'node:assert/strict'
import test from 'node:test'
import { TravelService } from '../../src/app/services/world/TravelService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { content } from '../helpers/content.mjs'
import { legendarySkill } from '../../src/domain/skills/effects.ts'

test('legendary barter waives fares without money, reevaluates eligibility and preserves time and night limits', () => {
  const data = content(), time = new DayTimeService()
  let barter = data.skills.legendary.threshold
  let payments = 0
  const travel = new TravelService(data.locations, time, 2, {
    amount: data.daytime.busFare,
    pay: () => { payments++; return false },
    free: () => legendarySkill({ barter }, 'barter'),
  })
  const [a, b] = data.locations
  travel.openTravel()
  assert.equal(travel.getSnapshot().busFare, 0)
  travel.closeTravel()
  assert.equal(payments, 0)
  travel.openTravel(); travel.travelTo(b.id)
  travel.travelTo(a.id)
  assert.equal(travel.getSnapshot().currentLocationId, b.id)
  travel.openTravel(); travel.travelTo(a.id)
  assert.equal(time.getSnapshot().phase, 'morning')
  assert.equal(payments, 0)
  travel.openTravel()
  barter--
  travel.travelTo(b.id)
  assert.equal(travel.getSnapshot().paymentFailed, true)
  assert.equal(travel.getSnapshot().busFare, data.daytime.busFare)
  assert.equal(travel.getSnapshot().currentLocationId, a.id)
  assert.equal(payments, 1)
  barter++
  travel.travelTo(b.id)
  assert.equal(travel.getSnapshot().paymentFailed, false)
  assert.equal(travel.getSnapshot().currentLocationId, b.id)
  assert.equal(payments, 1)
  travel.openTravel()
  time.advance(); time.advance(); time.advance()
  travel.travelTo(a.id)
  assert.equal(travel.getSnapshot().menuOpen, false)
  assert.equal(travel.getSnapshot().currentLocationId, b.id)
  assert.equal(travel.openTravel(), false)
  assert.equal(payments, 1)
})

test('bus trips charge one; canceled, invalid, current-district and walking trips are free', () => {
  const data = content(), time = new DayTimeService()
  data.locations.sort((a, b) => Number(b.id === 'living-district') - Number(a.id === 'living-district'))
  const inventory = new InventoryService(['item'], [])
  inventory.grantItems([], 2)
  const travel = new TravelService(data.locations, time, 2, { amount: data.daytime.busFare, pay: inventory.spendMoney })
  const [a, b] = data.locations
  assert.equal(data.daytime.busFare, 1)
  travel.travelTo(b.id)
  travel.openTravel(); travel.closeTravel()
  travel.openTravel(); travel.travelTo('missing')
  travel.travelTo(a.id)
  assert.equal(inventory.getSnapshot().money, 2)
  travel.openTravel(); travel.travelTo(b.id)
  assert.equal(inventory.getSnapshot().money, 1)
  travel.travelTo(a.id)
  assert.equal(inventory.getSnapshot().money, 1, 'duplicate confirmation cannot charge')
  travel.openTravel(); travel.travelTo(a.id)
  assert.equal(inventory.getSnapshot().money, 0)
  assert.equal(time.getSnapshot().phase, 'morning')
  travel.openTravel()
  const before = travel.getSnapshot(), beforeTime = time.getSnapshot()
  travel.travelTo(b.id)
  assert.equal(travel.getSnapshot().paymentFailed, true)
  assert.equal(travel.getSnapshot().menuOpen, true)
  assert.equal(travel.getSnapshot().journey, before.journey)
  assert.equal(travel.getSnapshot().currentLocationId, a.id)
  assert.equal(time.getSnapshot(), beforeTime)
  travel.closeTravel(); travel.openTravel('walk'); travel.travelTo('center')
  assert.equal(travel.getSnapshot().currentLocationId, 'center')
  assert.equal(inventory.getSnapshot().money, 0)
  assert.equal(time.getSnapshot().phase, 'afternoon')
})

test('wallet rejects invalid payments without changing the balance', () => {
  const inventory = new InventoryService(['item'], [])
  inventory.grantItems([], 1)
  for (const amount of [-1, 0.5, NaN, Infinity, 2]) assert.equal(inventory.spendMoney(amount), false)
  assert.equal(inventory.getSnapshot().money, 1)
  assert.equal(inventory.spendMoney(1), true)
  assert.equal(inventory.getSnapshot().money, 0)
})

test('night closes bus service before payment, while walking and morning bus routes still work', () => {
  const data = content(), time = new DayTimeService(1, 'evening')
  data.locations.sort((a, b) => Number(b.id === 'living-district') - Number(a.id === 'living-district'))
  const inventory = new InventoryService(['item'], [])
  inventory.grantItems([], 3)
  const travel = new TravelService(data.locations, time, 2, { amount: 1, pay: inventory.spendMoney })
  const [a, b] = data.locations
  travel.openTravel()
  time.advance()
  travel.travelTo(b.id)
  assert.equal(travel.getSnapshot().menuOpen, false)
  assert.equal(travel.getSnapshot().currentLocationId, a.id)
  assert.equal(inventory.getSnapshot().money, 3)
  travel.openTravel()
  assert.equal(travel.getSnapshot().menuOpen, false)
  travel.openTravel('walk'); travel.travelTo('center')
  assert.equal(travel.getSnapshot().currentLocationId, 'center')
  assert.equal(inventory.getSnapshot().money, 3)
  assert.equal(time.getSnapshot().phase, 'night')
  travel.openTravel('walk', 'right'); travel.travelTo('living-district')
  travel.openTravel('walk', 'left'); travel.travelTo('center')
  assert.equal(time.getSnapshot().phase, 'morning')
  travel.openTravel(); travel.travelTo(a.id)
  assert.equal(inventory.getSnapshot().money, 2)
})
