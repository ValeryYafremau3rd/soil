import assert from 'node:assert/strict'
import test from 'node:test'
import { LockpickingService } from '../../src/app/services/LockpickingService.ts'
import { StatisticsService } from '../../src/app/services/StatisticsService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'

test('successful locks identify containers and doors once; cancellation counts nothing', () => {
  const totals = new StatisticsService()
  const locks = new LockpickingService(new DayTime(1, 'night'), () => 0,
    { lockpickingBaseSeconds: 10, lockpickingSecondsPerPoint: 1 },
    { has: () => true, consume: () => true }, () => 0, () => 0)
  locks.onLockType = kind => totals.record(kind === 'container' ? 'containersLockpicked' : 'doorsLockpicked')
  const solve = () => {
    const target = locks.getSnapshot().puzzle.target
    const numbers = []
    for (let a = 1; a <= 9 && !numbers.length; a++) for (let b = 1; b <= 9 && !numbers.length; b++) {
      const c = target - a - b
      if (c >= 1 && c <= 9) numbers.push(a, b, c)
    }
    numbers.forEach((value, index) => locks.setNumber(index, value))
    locks.submit(); locks.submit()
  }
  locks.attemptContainer('cancelled', 'Cancelled', () => {})
  locks.close()
  assert.deepEqual(totals.getSnapshot(), {})
  let opened = 0
  locks.attemptContainer('safe', 'Safe', () => opened++)
  solve()
  locks.attempt('door', 'Door')
  solve()
  assert.equal(opened, 1)
  assert.deepEqual(totals.getSnapshot(), { containersLockpicked: 1, doorsLockpicked: 1 })
})
