import test from 'node:test'
import assert from 'node:assert/strict'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { drainStatusWithTime } from '../../src/app/services/character/drainStatusWithTime.ts'
import { advanceSleepDebt } from '../../src/domain/character/sleep.ts'
import { content } from '../helpers/content.mjs'

test('sleep debt charges only phases beyond the grace period, including skipped phases', () => {
  const settings = { gracePhases: 4, sanityPerPhase: 5 }
  assert.deepEqual(advanceSleepDebt(0, 4, false, settings), { awakePhases: 4, damage: 0 })
  assert.deepEqual(advanceSleepDebt(3, 3, false, settings), { awakePhases: 6, damage: 10 })
  assert.deepEqual(advanceSleepDebt(8, 4, true, settings), { awakePhases: 0, damage: 0 })
})

test('sleep restores vitals per phase and clears debt once', () => {
  const data = content()
  assert.equal(data.ui.rest.sanityRecovery.rest, 0)
  assert.equal(data.ui.rest.sanityRecovery.sleep, 10)
  const time = new DayTimeService()
  const status = new StatusService(['health', 'energy', 'sanity'].map(id => ({ id, value: 100, max: 100 })))
  const rest = new RestService(time, status)
  const sleep = { ...data.daytime.sleepDeprivation, awakePhases: 0, isSleeping: () => rest.isSleeping }
  const stop = drainStatusWithTime(time, status, { energy: 2, sanity: 1 }, () => rest.isAdvancingTime, sleep)
  for (let i = 0; i < 4; i++) time.advance()
  assert.equal(status.getSnapshot().sanity, 96)
  time.advance()
  assert.equal(status.getSnapshot().sanity, 90)
  rest.open('rest', 'Bench'); rest.confirm()
  assert.equal(sleep.awakePhases, 6)
  assert.equal(status.getSnapshot().sanity, 84)
  status.drain({ energy: 80, sanity: 20 })
  const energy = status.getSnapshot().energy
  rest.open('sleep', 'Bed'); rest.close(); rest.confirm()
  assert.equal(sleep.awakePhases, 6, 'cancel does not reset debt')
  rest.open('sleep', 'Bed'); rest.confirm()
  assert.equal(sleep.awakePhases, 0)
  assert.equal(status.getSnapshot().sanity, 82, 'sleep retains elapsed base sanity costs')
  assert.equal(status.getSnapshot().energy, Math.min(100, energy + 100), 'sleep time has no energy drain')
  const after = status.getSnapshot()
  rest.confirm()
  assert.equal(status.getSnapshot(), after)
  time.advance()
  assert.equal(status.getSnapshot().sanity, 81, 'sleep starts a new grace period')
  stop()
})
