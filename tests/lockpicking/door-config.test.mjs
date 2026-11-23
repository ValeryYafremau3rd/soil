import test from 'node:test'
import assert from 'node:assert/strict'
import { LockpickingService } from '../../src/app/services/puzzles/LockpickingService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('configured open hall bypasses locks at night without unlocking apartment rooms', () => {
  const config = content().skills
  const locks = new LockpickingService(new DayTimeService(1, 'night'), () => 0, config,
    { has: () => false, consume: () => false })
  assert.equal(locks.attempt('apartments', 'Hall'), true)
  assert.equal(locks.isLocked('apartments:apartment-11', 'apartment-11'), true)
  assert.equal(locks.getSnapshot().puzzle, null)
})

test('door rarity controls target difficulty and configured locks survive cancellation', () => {
  const config = { ...content().skills, doorLocks: { apartments: { locked: true, rarity: 'rare' } } }
  const locks = new LockpickingService(new DayTimeService(1, 'morning'), () => 0, config,
    { has: () => true, consume: () => true }, () => 0, () => 0.999)
  assert.equal(locks.attempt('apartments', 'Hall'), false)
  assert.equal(locks.getSnapshot().puzzle.target, config.lockpickingMaxSumByRarity.rare)
  locks.close()
  assert.equal(locks.isLocked('apartments'), true)
  locks.attempt('apartments', 'Hall')
  assert.ok(locks.getSnapshot().puzzle)
})

test('facing and door configuration reject invalid values and unknown door references', () => {
  for (const mutate of [
    input => { input.npcs.worker.flipX = 'left' },
    input => { input.skills.doorLocks.apartments.rarity = 'hard' },
    input => { input.skills.doorLocks.missing = { locked: false } },
  ]) {
    const input = content()
    mutate(input)
    assert.throws(() => validateContent(input), /flipX|doorLocks/)
  }
  const input = content()
  input.npcs.worker.flipX = true
  assert.doesNotThrow(() => validateContent(input))
})

test('key-only doors reject lockpicks even at legendary skill and open with their key', () => {
  let hasKey = false
  const config = { ...content().skills, doorLocks: { apartments: { keyOnly: true } } }
  const locks = new LockpickingService(new DayTimeService(1, 'morning'), () => 30, config,
    { has: () => true, consume: () => { throw new Error('Must not consume a lockpick') } },
    () => 0, () => 0, () => {}, () => hasKey)
  assert.equal(locks.attempt('apartments', 'Hall'), false)
  assert.equal(locks.getSnapshot().puzzle, null)
  hasKey = true
  assert.equal(locks.attempt('apartments', 'Hall'), true)
})
