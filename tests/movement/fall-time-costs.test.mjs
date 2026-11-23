import assert from 'node:assert/strict'
import test from 'node:test'
import { fallDamage, FallTracker } from '../../src/domain/movement/fallDamage.ts'
import { beginJump, jumpGravity, restingAt, stepVertical } from '../../src/domain/movement/platforms.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { TravelService } from '../../src/app/services/world/TravelService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { drainStatusWithTime } from '../../src/app/services/character/drainStatusWithTime.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, content } from '../helpers/content.mjs'

const data = content()
const settings = data.hero.settings.fallDamage
const gravity = jumpGravity(data.hero.settings.jumpHeight, 700)

test('fall damage has a safe threshold and increases with excess height', () => {
  assert.equal(fallDamage(95, settings), 0)
  assert.equal(fallDamage(140, settings), 0)
  assert.equal(fallDamage(145, settings), 1)
  assert.equal(fallDamage(200, settings), 12)
  assert.equal(fallDamage(300, settings), 32)
  assert.equal(fallDamage(0, settings), 0)
  assert.equal(fallDamage(NaN, settings), 0)
})

test('ordinary jumps land without damage, and tall falls damage once on landing', () => {
  for (const [initial, expected] of [
    [beginJump(restingAt(500), data.hero.settings.jumpHeight, gravity), 0],
    [{ y: 200, velocity: 0, grounded: false }, 32],
  ]) {
    const tracker = new FallTracker(settings)
    let state = initial, damage = 0, hits = 0
    for (let frame = 0; frame < 200; frame++) {
      const next = stepVertical(state, 50, 8, 1 / 60, gravity, 500, 0, [])
      const hit = tracker.update(state, next)
      if (!next.grounded) assert.equal(hit, 0, 'damage waits for landing')
      if (hit) hits++
      damage += hit
      state = next
    }
    assert.equal(state.grounded, true)
    assert.equal(damage, expected)
    assert.equal(hits, expected ? 1 : 0)
  }
})

test('walking off a ledge tracks its height and intermediate landings start fresh drops', () => {
  const tracker = new FallTracker(settings)
  let state = { y: 200, velocity: 0, grounded: true, supportId: 'ledge' }
  const middle = { id: 'middle', left: 0, right: 100, y: 300 }
  let damage = 0
  while (state.y < middle.y || !state.grounded) {
    const next = stepVertical(state, 50, 8, 1 / 60, gravity, 500, 0, [middle])
    damage += tracker.update(state, next)
    state = next
  }
  assert.equal(damage, 0, 'the first 100-pixel drop is safe')
  for (let frame = 0; frame < 100; frame++) {
    const next = stepVertical(state, 150, 8, 1 / 60, gravity, 500, 0, [middle])
    damage += tracker.update(state, next)
    state = next
  }
  assert.equal(damage, 12, 'only the later 200-pixel drop counts')
})

test('teleport and staircase resets discard the old airborne peak', () => {
  const tracker = new FallTracker(settings)
  tracker.update({ y: 0, velocity: 0, grounded: false }, { y: 100, velocity: 100, grounded: false })
  tracker.reset()
  assert.equal(tracker.update(restingAt(500), restingAt(500)), 0)
  assert.equal(tracker.update({ y: 450, velocity: 0, grounded: false }, restingAt(500)), 0)
})

test('time costs count elapsed phases, including sleep skips, without an initial charge', () => {
  const time = new DayTimeService(), status = new StatusService()
  const unsubscribe = drainStatusWithTime(time, status, data.daytime.statCostsPerPhase)
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 50, sanity: 50 })
  time.advance()
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 45, sanity: 49 })
  time.nextMorning()
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 30, sanity: 46 })
  time.nextMorning()
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 10, sanity: 42 })
  for (let phase = 0; phase < 100; phase++) time.advance()
  assert.deepEqual(status.getSnapshot(), { health: 0, energy: 0, sanity: 0 })
  unsubscribe()
  assert.equal(status.recover({ energy: 10, sanity: 10 }), false, 'zero Sanity is fatal')
  status.configure(data.ui.stats, 1)
  time.advance()
  assert.equal(status.getSnapshot().energy, 50)
})

test('travel, rest and sleep spend the same game time, while canceled actions spend nothing', () => {
  const time = new DayTimeService(), status = new StatusService()
  const travel = new TravelService([{ id: 'a' }, { id: 'b' }], time, 2)
  const rest = new RestService(time, status)
  drainStatusWithTime(time, status, data.daytime.statCostsPerPhase, () => rest.isAdvancingTime)
  rest.open('rest', 'Bench'); rest.close(); rest.confirm()
  travel.openTravel(); travel.closeTravel()
  assert.equal(status.getSnapshot().energy, 50)
  travel.openTravel(); travel.travelTo('b')
  assert.equal(status.getSnapshot().energy, 50, 'half-phase bus progress does not charge twice')
  travel.openTravel(); travel.travelTo('a')
  assert.equal(status.getSnapshot().energy, 45)
  rest.open('rest', 'Bench'); rest.confirm()
  assert.equal(status.getSnapshot().energy, 60)
  rest.open('sleep', 'Bed'); rest.confirm()
  assert.deepEqual(status.getSnapshot(), { health: 100, energy: 100, sanity: 46 })
})

test('custom time costs and zero costs work; invalid values do not increase stats', () => {
  const time = new DayTimeService(4, 'night'), status = new StatusService()
  const unsubscribe = drainStatusWithTime(time, status, { energy: 2, sanity: 0 })
  time.advance()
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 48, sanity: 50 })
  unsubscribe()
  status.drain({ energy: -20, sanity: NaN })
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 48, sanity: 50 })
})

test('invalid fall and time cost configuration fails before gameplay', () => {
  for (const [mutate, pattern] of [
    [data => { data.hero.settings.fallDamage.safeHeight = -1 }, /fallDamage.safeHeight/],
    [data => { data.hero.settings.fallDamage.damagePerPixel = -1 }, /fallDamage.damagePerPixel/],
    [data => { data.daytime.statCostsPerPhase.energy = -1 }, /statCostsPerPhase.energy/],
    [data => { data.daytime.statCostsPerPhase.sanity = 1.5 }, /statCostsPerPhase.sanity/],
  ]) {
    const { data, sources } = catalogue()
    mutate(data)
    assert.throws(() => validateContent(data, sources), pattern)
  }
})
