import assert from 'node:assert/strict'
import test from 'node:test'
import { OptionsService } from '../../src/app/services/session/OptionsService.ts'

test('difficulty changes preserve session state without writing the save slot', () => {
  let selected = 'normal'
  let loaded
  let writes = 0
  const state = { difficultyId: 'normal', status: { health: 12 }, inventory: { money: 7 } }
  const options = new OptionsService(
    { read: () => null, write: () => { writes++ } },
    () => state, value => value, value => { loaded = value },
    () => {}, () => {}, null, () => {},
    { ids: ['normal', 'hard'], getId: () => selected, select: id => { selected = id } }
  )
  options.changeDifficulty('unknown')
  assert.equal(selected, 'normal')
  options.changeDifficulty('hard')
  assert.equal(options.getDifficulty(), 'hard')
  assert.equal(loaded, undefined)
  options.updatePosition({ locationId: 'home', x: 10, y: 20 })
  options.changeDifficulty('hard')
  assert.equal(loaded, undefined)
  options.changeDifficulty('normal')
  assert.deepEqual(loaded, { ...state, difficultyId: 'normal' })
  assert.equal(loaded.status, state.status)
  assert.equal(loaded.inventory, state.inventory)
  assert.equal(writes, 0)
})

test('difficulty changes ignore sessions that cannot be captured', () => {
  const options = new OptionsService(
    { read: () => null, write: () => assert.fail('unexpected save') },
    () => null, value => value, () => assert.fail('unexpected load'),
    () => {}, () => {}, null, () => {},
    { ids: ['normal', 'hard'], getId: () => 'normal', select: () => {} }
  )
  options.updatePosition({ locationId: 'home', x: 10, y: 20 })
  options.changeDifficulty('hard')
  assert.equal(options.getDifficulty(), 'normal')
})
