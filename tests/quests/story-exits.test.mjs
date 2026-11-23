import test from 'node:test'
import assert from 'node:assert/strict'
import { storySetup, progressFor, emptyStory } from '../helpers/story.mjs'

function prepare(s, official = false) {
  s.quests.restoreState([
    ...progressFor(s.data, official ? 'prologue-government-exit' : 'prologue-last-night', official ? 2 : undefined),
    { questId: 'way-out-of-town', stageIndex: 1 },
  ])
  const state = emptyStory()
  if (official) state.decisions.government_exit_bargain = 'accept'
  s.story.restoreState(state)
}

test('illegal gate requires Titan key and finales; optional jobs and official route do not block it', () => {
  const s = storySetup([{ itemId: 'strange-key', quantity: 1 }])
  assert.equal(s.story.interact('factory-perimeter-service-gate'), false)
  prepare(s)
  assert.equal(s.quests.isCompleted('smuggler-4'), false)
  assert.equal(s.story.interact('factory-perimeter-service-gate'), true)
  assert.equal(s.quests.isCompleted('way-out-of-town'), true)
  assert.equal(s.story.getSnapshot().flags.ending_route, 'illegal')
  assert.equal(s.story.getSnapshot().flags.prologue_complete, true)
  const items = structuredClone(s.inventory.getSnapshot().items)
  assert.equal(s.story.interact('factory-perimeter-service-gate'), false)
  assert.deepEqual(s.inventory.getSnapshot().items, items)
})

test('checkpoint handoff grants a real exit permit; official route never needs the Titan key', () => {
  const s = storySetup([{ itemId: 'work-pass', quantity: 1 }])
  prepare(s, true)
  assert.equal(s.story.interact('district-official-checkpoint'), false)
  s.story.interact('checkpoint-handoff')
  assert.ok(s.inventory.getSnapshot().items.some(item => item.itemId === 'exit-permit'))
  assert.equal(s.story.getSnapshot().flags.official_exit_ready, true)
  s.dialogue.closeDialogue()
  assert.equal(s.story.interact('district-official-checkpoint'), true)
  assert.equal(s.quests.isCompleted('prologue-government-exit'), true)
  assert.equal(s.quests.isCompleted('way-out-of-town'), true)
  assert.equal(s.story.getSnapshot().flags.ending_route, 'official')
  assert.equal(s.inventory.getSnapshot().items.some(item => item.itemId === 'exit-permit'), false)
  assert.equal(s.inventory.getSnapshot().items.some(item => item.itemId === 'work-pass'), true)
})

test('refusing Pavel leaves illegal exit available and never issues a permit', () => {
  const s = storySetup([{ itemId: 'strange-key', quantity: 1 }])
  prepare(s, true)
  const state = emptyStory()
  state.decisions.government_exit_bargain = 'refuse'
  s.story.restoreState(state)
  s.story.interact('checkpoint-handoff')
  assert.equal(s.inventory.getSnapshot().items.some(item => item.itemId === 'exit-permit'), false)
  assert.equal(s.story.interact('district-official-checkpoint'), false)
  assert.equal(s.story.interact('factory-perimeter-service-gate'), true)
})

test('full reward capacity rejects the key exit without partial rewards; freeing space permits retry', () => {
  const s = storySetup([{ itemId: 'strange-key', quantity: 1 },
    ...Array.from({ length: 5 }, () => ({ itemId: 'cloth', quantity: 1 }))])
  prepare(s)
  assert.equal(s.story.interact('factory-perimeter-service-gate'), false)
  assert.equal(s.quests.isCompleted('way-out-of-town'), false)
  assert.equal(s.story.getSnapshot().flags.ending_route, undefined)
  assert.equal(s.inventory.getSnapshot().items.some(item => item.itemId === 'compass'), false)
  s.inventory.removeItems([{ itemId: 'cloth', quantity: 1 }])
  assert.equal(s.story.interact('factory-perimeter-service-gate'), true)
  assert.equal(s.inventory.getSnapshot().items.find(item => item.itemId === 'compass').quantity, 1)
})
