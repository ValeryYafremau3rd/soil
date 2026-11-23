import test from 'node:test'
import assert from 'node:assert/strict'
import { TravelService } from '../../src/app/services/world/TravelService.ts'
import { content } from '../helpers/content.mjs'
import { LocationLoadingService } from '../../src/app/services/session/LocationLoadingService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

function setup(fare) {
  const travel = new TravelService(content().locations, undefined, 2, fare, undefined, true)
  const loading = new LocationLoadingService(160)
  loading.subscribe(() => {
    if (loading.getSnapshot().phase === 'idle') travel.finishLocationLoad()
  })
  travel.restoreState({ locationId: 'factory', phaseTravels: 0 })
  return { travel, loading }
}

function finishLoading(loading) {
  loading.begin('Center', false)
  loading.ready()
  loading.finish()
}

test('first Center arrival waits for loading, opens three slides and persists completion', () => {
  const { travel, loading } = setup()
  travel.openTravel()
  travel.closeTravel()
  assert.equal(travel.getSnapshot().storySlide, null, 'cancel does not start story')
  travel.walkToBoundary('right')
  assert.equal(travel.getSnapshot().currentLocationId, 'center')
  assert.equal(travel.getSnapshot().storySlide, null, 'scene can restart before slides open')
  assert.equal(travel.openTravel(), false, 'arrival blocks another trip')
  assert.equal(travel.walkToBoundary('right'), false)
  loading.begin('Center')
  loading.covered()
  assert.equal(travel.getSnapshot().storySlide, null, 'loading stays above the new world')
  loading.ready()
  assert.equal(travel.getSnapshot().storySlide, null, 'reveal finishes before the story')
  loading.finish()
  assert.equal(travel.getSnapshot().storySlide, 0)
  travel.previousStorySlide()
  assert.equal(travel.getSnapshot().storySlide, 0, 'Back stops at the first slide')
  assert.equal(travel.openTravel(), false)
  assert.equal(travel.walkToBoundary('right'), false)
  travel.nextStorySlide()
  assert.equal(travel.getSnapshot().storySlide, 1)
  travel.finishLocationLoad()
  assert.equal(travel.getSnapshot().storySlide, 1, 'repeated readiness cannot reset the story')
  travel.nextStorySlide()
  assert.equal(travel.getSnapshot().storySlide, 2)
  travel.previousStorySlide()
  assert.equal(travel.getSnapshot().storySlide, 1)
  assert.equal(travel.openTravel(), false, 'Back keeps gameplay blocked')
  travel.nextStorySlide()
  travel.nextStorySlide()
  travel.nextStorySlide()
  assert.equal(travel.getSnapshot().storySlide, null)
  travel.previousStorySlide()
  assert.equal(travel.getSnapshot().storySlide, null, 'Back cannot reopen the story')
  assert.equal(travel.saveState().storySeen, true)
  travel.restoreState({ ...travel.saveState(), locationId: 'factory' })
  travel.walkToBoundary('right')
  assert.equal(travel.getSnapshot().storySlide, null, 'loaded completion never replays')
})

test('failed bus payment cannot queue slides; successful travel waits for Center loading', () => {
  let affordable = false
  const { travel, loading } = setup({
    amount: 1, pay: () => affordable,
  })
  travel.openTravel()
  travel.travelTo('center')
  assert.equal(travel.getSnapshot().storySlide, null)
  assert.equal(travel.getSnapshot().currentLocationId, 'factory')
  travel.finishLocationLoad()
  assert.equal(travel.getSnapshot().storySlide, null)
  affordable = true
  travel.travelTo('center')
  assert.equal(travel.getSnapshot().storySlide, null)
  finishLoading(loading)
  assert.equal(travel.getSnapshot().storySlide, 0)
})

test('saving a pending or unfinished Center story resumes it only after the restored world loads', () => {
  const { travel } = setup()
  travel.walkToBoundary('right')
  const pending = travel.saveState()
  assert.equal(pending.storySeen, false)
  const restored = setup()
  restored.travel.restoreState(pending)
  assert.equal(restored.travel.getSnapshot().storySlide, null)
  finishLoading(restored.loading)
  assert.equal(restored.travel.getSnapshot().storySlide, 0)
  restored.travel.nextStorySlide()
  const unfinished = restored.travel.saveState()
  assert.equal(unfinished.storySeen, false)
  restored.travel.restoreState(unfinished)
  finishLoading(restored.loading)
  assert.equal(restored.travel.getSnapshot().storySlide, 0)
})

test('restoring Factory cancels a pending arrival; other destinations never start the Center story', () => {
  const { travel, loading } = setup()
  travel.walkToBoundary('right')
  travel.restoreState({ locationId: 'factory', phaseTravels: 0 })
  finishLoading(loading)
  assert.equal(travel.getSnapshot().storySlide, null)
  assert.equal(travel.openTravel(), true)
  travel.travelTo('living-district')
  finishLoading(loading)
  assert.equal(travel.getSnapshot().storySlide, null)
  assert.equal(travel.saveState().storySeen, false)
})

test('opening story destination must reference an authored location', () => {
  const data = content()
  data.ui.story.destinationLocationId = 'missing'
  assert.throws(() => validateContent(data), /story.destinationLocationId/)
})

test('legacy Center saves without story completion metadata do not introduce an arrival replay', () => {
  const { travel, loading } = setup()
  travel.restoreState({ locationId: 'center', phaseTravels: 0 })
  finishLoading(loading)
  assert.equal(travel.getSnapshot().storySlide, null)
})
