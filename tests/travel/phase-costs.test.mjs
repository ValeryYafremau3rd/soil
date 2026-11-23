import test from 'node:test'
import assert from 'node:assert/strict'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { drainStatusWithTime } from '../../src/app/services/character/drainStatusWithTime.ts'
import { content } from '../helpers/content.mjs'

test('each elapsed phase charges five percent of current limits, including rollover', () => {
  const time = new DayTimeService(1, 'evening')
  const status = new StatusService([
    { id: 'health', value: 100, max: 100 },
    { id: 'energy', value: 200, max: 200 },
    { id: 'sanity', value: 150, max: 150 },
  ])
  const stop = drainStatusWithTime(time, status, content().daytime.statCostsPerPhase)
  assert.equal(status.getSnapshot().energy, 200, 'subscribing charges nothing')
  time.advance()
  assert.deepEqual(status.getSnapshot(), { health: 100, energy: 190, sanity: 142.5 })
  time.nextMorning()
  assert.equal(time.getSnapshot().day, 2)
  assert.deepEqual(status.getSnapshot(), { health: 100, energy: 180, sanity: 135 })
  time.nextMorning()
  assert.deepEqual(status.getSnapshot(), { health: 100, energy: 140, sanity: 105 })
  stop()
  time.advance()
  assert.equal(status.getSnapshot().energy, 140, 'unsubscribing stops charges')
})

test('phase costs use updated limits and rest exempts only Energy', () => {
  const time = new DayTimeService()
  const status = new StatusService()
  status.setLimits(content().ui.stats.map(stat => ({ ...stat, max: 200 })))
  const stop = drainStatusWithTime(time, status, content().daytime.statCostsPerPhase, () => true)
  time.advance()
  assert.equal(status.getSnapshot().energy, 100)
  assert.equal(status.getSnapshot().sanity, 90)
  stop()
})
