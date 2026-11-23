import test from 'node:test'
import assert from 'node:assert/strict'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'

test('sleep restores percentages of each vital limit for every selected tick', () => {
  for (const phases of [1, 2, 3, 4]) {
    const status = new StatusService([
      { id: 'health', value: 20, max: 200 },
      { id: 'energy', value: 0, max: 80 },
      { id: 'sanity', value: 10, max: 150 },
    ])
    const rest = new RestService(new DayTimeService(1, 'night'), status)
    assert.deepEqual(rest.getRecovery('sleep'), { health: 20, energy: 40, sanity: 15 })
    rest.open('sleep', 'Bed'); rest.confirm(phases)
    assert.deepEqual(status.getSnapshot(), {
      health: 20 + 20 * phases, energy: Math.min(80, 40 * phases), sanity: 10 + 15 * phases,
    })
    rest.confirm(phases)
    assert.equal(status.getSnapshot().health, 20 + 20 * phases)
  }
})

for (const kind of ['rest', 'sleep']) {
  test(`${kind} skips the chosen phases across midnight and recovers/saves once`, () => {
    for (const phases of [1, 2, 3, 4]) {
      const time = new DayTimeService(3, 'evening')
      let recoveries = 0, saves = 0, elapsed = 0
      const rest = new RestService(time, { recover: () => { recoveries++ } },
        { rest: 3, sleep: 7 }, () => { saves++ })
      time.subscribe(() => {
        elapsed++
        assert.equal(rest.isAdvancingTime, true)
        assert.equal(rest.isSleeping, kind === 'sleep')
      })
      rest.open(kind, 'Furniture')
      rest.confirm(phases)
      assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), {
        day: 3 + Math.floor((2 + phases) / 4),
        phase: ['morning', 'afternoon', 'evening', 'night'][(2 + phases) % 4],
      })
      assert.equal(elapsed, phases)
      assert.equal(recoveries, 1)
      assert.equal(saves, kind === 'sleep' ? 1 : 0)
      assert.equal(rest.isAdvancingTime, false)
      assert.equal(rest.isSleeping, false)
      rest.confirm(phases)
      assert.equal(recoveries, 1)
    }
  })
}

test('invalid durations and cancelled choices do not consume time or recover', () => {
  const time = new DayTimeService()
  let recoveries = 0
  const rest = new RestService(time, { recover: () => { recoveries++ } })
  rest.open('sleep', 'Bed')
  for (const phases of [0, -1, 5, 1.5, NaN, Infinity]) rest.confirm(phases)
  assert.ok(rest.getSnapshot().menu)
  rest.close()
  rest.confirm(3)
  assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 1, phase: 'morning' })
  assert.equal(recoveries, 0)
})
