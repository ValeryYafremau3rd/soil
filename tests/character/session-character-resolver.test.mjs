import assert from 'node:assert/strict'
import test from 'node:test'
import { createEffectiveCharacterResolver } from '../../src/app/bootstrap/session/createEffectiveCharacterResolver.ts'

test('unselected characters do not read services that are still being initialized', () => {
  const notReady = () => { throw new Error('Service is not initialized') }
  const currentCharacter = createEffectiveCharacterResolver({
    getCharacter: () => null,
    getInventory: notReady,
    getStatus: notReady,
    getPerks: notReady,
    definitions: {},
  })
  assert.equal(currentCharacter(), null)
  assert.equal(currentCharacter(), null)
})
