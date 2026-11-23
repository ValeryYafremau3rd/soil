import test from 'node:test'
import assert from 'node:assert/strict'
import { storySetup, progressFor } from '../helpers/story.mjs'
import { validateSave } from '../../src/app/persistence/validateSave.ts'
import { migrateStoryPrerequisites } from '../../src/app/persistence/migrateStoryPrerequisites.ts'
import { validateLegacyStoryPrerequisites } from '../../src/app/persistence/migrateStoryPrerequisites.ts'

function capture(s) {
  const data = s.data
  const references = { classIds: ['test'], difficultyIds: [data.difficulty.defaultId],
    npcIds: Object.keys(data.npcs), locations: data.locations, items: data.items,
    quests: data.quests, buildings: data.buildings, rooms: data.rooms,
    containerIds: [], travelsPerPhase: data.daytime.travelsPerPhase, story: data.story }
  const save = { version: 1, openingVersion: 1, escapeCluesVersion: 1, savedAt: new Date().toISOString(),
    classId: 'test', difficultyId: data.difficulty.defaultId, daytime: s.daytime.getSnapshot(),
    status: { health: 50, energy: 50, sanity: 50 }, inventory: s.inventory.saveState(),
    quests: s.quests.getSnapshot().progress, story: s.story.getSnapshot(),
    travel: { locationId: 'center', phaseTravels: 0 }, unlockedDoors: [],
    position: { locationId: 'center', x: 100, y: 500 } }
  return { save, references }
}

test('decisions and queued consequences survive full save validation and execute once after sleep', () => {
  const s = storySetup()
  s.restore('factory-locked-workshop', 2)
  s.open('worker')
  s.dialogue.chooseReply('decision-topic-dusan_fate')
  s.dialogue.chooseReply('factory-workshop-report-report')
  const { save, references } = capture(s)
  const restored = validateSave(JSON.parse(JSON.stringify(save)), references)
  assert.deepEqual(restored.story, save.story)
  const next = storySetup()
  next.quests.restoreState(restored.quests)
  next.story.restoreState(restored.story)
  next.daytime.nextMorning()
  assert.equal(next.story.isNpcAbsent('citizen-mechanic'), true)
  next.daytime.nextMorning()
  assert.equal(next.story.getSnapshot().absentNpcIds.filter(id => id === 'citizen-mechanic').length, 1)
  assert.equal(next.story.getSnapshot().consequences.length, 0)
  const forged = structuredClone(save)
  forged.story.consequences[0].npcId = 'missing'
  assert.throws(() => validateSave(forged, references))
})

test('ending save restores terminal route and completed escape without replaying rewards', () => {
  const s = storySetup([{ itemId: 'strange-key', quantity: 1 }])
  s.quests.restoreState([...progressFor(s.data, 'prologue-last-night'),
    { questId: 'way-out-of-town', stageIndex: 1 }])
  s.story.restoreState()
  assert.equal(s.story.interact('factory-perimeter-service-gate'), true)
  const { save, references } = capture(s)
  const restored = validateSave(save, references)
  assert.equal(restored.story.flags.ending_route, 'illegal')
  const next = storySetup(restored.inventory.items)
  next.quests.restoreState(restored.quests)
  next.story.restoreState(restored.story)
  const before = structuredClone(next.inventory.getSnapshot().items)
  assert.equal(next.story.interact('factory-perimeter-service-gate'), false)
  assert.deepEqual(next.inventory.getSnapshot().items, before)
  const forged = structuredClone(save)
  forged.story.flags.ending_route = 'official'
  assert.throws(() => validateSave(forged, references))
})

test('legacy story gates preserve old progress and inventory without granting new prerequisite rewards', () => {
  const s = storySetup()
  const { save, references } = capture(s)
  delete save.story
  save.quests = [{ questId: 'factory-supplies', stageIndex: 2 }]
  const before = structuredClone(save)
  migrateStoryPrerequisites(save, references)
  assert.deepEqual(save.legacyQuestPrerequisites, { 'factory-supplies': ['town-opinions'] })
  assert.deepEqual(save.quests, before.quests)
  assert.deepEqual(save.inventory, before.inventory)
  const once = structuredClone(save)
  migrateStoryPrerequisites(save, references)
  assert.deepEqual(save, once)
  save.legacyQuestPrerequisites['factory-supplies'].push('smuggler-3')
  assert.throws(() => validateLegacyStoryPrerequisites(save))
})
