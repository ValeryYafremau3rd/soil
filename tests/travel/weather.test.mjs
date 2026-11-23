import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rollWeather } from '../../src/domain/character/weather.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'

test('weather allocates exactly 15% per effect and 25% clear', () => {
  const counts = {}
  for (let i = 0; i < 10000; i++) {
    const weather = rollWeather(() => (i + 0.5) / 10000)
    counts[weather] = (counts[weather] ?? 0) + 1
  }
  assert.deepEqual(counts, { rain: 1500, snow: 1500, fog: 1500, storm: 1500, wind: 1500, clear: 2500 })
})

test('night rolls once and weather survives morning and restoration', () => {
  let calls = 0
  const time = new DayTimeService(1, 'morning', 'rain', () => { calls++; return 0.4 })
  time.advance()
  time.advance()
  assert.equal(calls, 0)
  time.advance()
  assert.equal(calls, 1)
  assert.equal(time.getSnapshot().weather, 'fog')
  time.nextMorning()
  assert.equal(calls, 1)
  const saved = time.getSnapshot()
  const restored = new DayTimeService(saved.day, saved.phase, saved.weather, () => { throw Error('rerolled') })
  assert.deepEqual(restored.getSnapshot(), saved)
})

test('sleeping over night rolls once; a new game or legacy save rolls initial weather', () => {
  let calls = 0
  const random = () => { calls++; return 0.99 }
  const time = new DayTimeService(1, 'morning', undefined, random)
  assert.equal(calls, 1)
  time.nextMorning()
  assert.equal(calls, 2)
  assert.deepEqual(time.getSnapshot(), { day: 2, phase: 'morning', weather: 'clear' })
})
