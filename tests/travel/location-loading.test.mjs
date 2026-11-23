import assert from 'node:assert/strict'
import test from 'node:test'
import { LocationLoadingService } from '../../src/app/services/session/LocationLoadingService.ts'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('location transition covers the old world, waits for loading, then reveals the destination', () => {
  const loading = new LocationLoadingService(160)
  assert.equal(loading.getSnapshot().phase, 'idle')
  assert.equal(loading.begin('Factory'), true)
  assert.deepEqual(loading.getSnapshot(), { phase: 'fade-out', locationName: 'Factory' })
  loading.ready()
  loading.finish()
  assert.equal(loading.getSnapshot().phase, 'fade-out', 'cannot reveal before black covers the old scene')
  loading.covered()
  loading.finish()
  assert.equal(loading.getSnapshot().phase, 'loading', 'remains covered until the new scene is ready')
  loading.ready()
  assert.equal(loading.getSnapshot().phase, 'fade-in')
  loading.finish()
  assert.equal(loading.getSnapshot().phase, 'idle')
})

test('startup can start fully black; repeated requests and stale completion calls do not replace the destination', () => {
  const loading = new LocationLoadingService(160)
  loading.ready()
  loading.finish()
  assert.equal(loading.begin('Center', false), true)
  assert.equal(loading.getSnapshot().phase, 'loading')
  assert.equal(loading.begin('Factory'), false)
  assert.equal(loading.getSnapshot().locationName, 'Center')
  loading.ready()
  loading.covered()
  assert.equal(loading.getSnapshot().phase, 'fade-in')
  loading.finish()
  assert.equal(loading.begin('Living District'), true)
})

test('loading UI configuration rejects invalid fade timing', () => {
  const data = content()
  data.ui.locationTransition.fadeMs = -1
  assert.throws(() => validateContent(data), /locationTransition.fadeMs/)
})
