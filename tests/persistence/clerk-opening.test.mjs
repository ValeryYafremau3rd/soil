import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateOpening } from '../../src/app/persistence/migrateOpening.ts'

test('older clerk saves retain their keys and begin the tutorial after handover, exactly once', () => {
  const references = { quests: [{ id: 'first-steps' }] }
  const save = { openingVersion: 1, quests: [{ questId: 'find-work', stageIndex: 1, completedStageIds: ['visit-apartment'] }] }
  migrateOpening(save, references)
  assert.deepEqual(save.quests[1], { questId: 'first-steps', stageIndex: 1 })
  assert.deepEqual(save.quests[0].completedStageIds, ['visit-apartment'])
  migrateOpening(save, references)
  assert.equal(save.quests.length, 2)
  const unintroduced = { openingVersion: 1, quests: [{ questId: 'find-work', stageIndex: 0 }] }
  migrateOpening(unintroduced, references)
  assert.equal(unintroduced.quests.length, 1)
})
