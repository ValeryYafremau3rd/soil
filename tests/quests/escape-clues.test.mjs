import test from 'node:test'
import assert from 'node:assert/strict'
import { storySetup, progressFor } from '../helpers/story.mjs'
import { migrateEscapeClues } from '../../src/app/persistence/migrateEscapeClues.ts'

const questId = 'way-out-of-town'
const clues = [['bartender', 'escape-guard-key'], ['worker', 'escape-night-shadow']]

/** Finish Irina's authored factory chain while keeping the main clue objectives active. */
function finishIrina(s) {
  s.quests.restoreState([
    ...progressFor(s.data, 'factory-locked-workshop'),
    { questId, stageIndex: 1 },
  ])
}

for (const order of [clues, [...clues].reverse()]) {
  test(`escape testimony persists independently, starting with ${order[0][0]}`, () => {
    const s = storySetup()
    finishIrina(s)
    const progress = () => s.quests.getSnapshot().progress.find(q => q.questId === questId)
    const collect = ([npc, choice]) => { s.open(npc); s.dialogue.chooseReply(choice) }
    collect(order[0])
    assert.equal(progress().stageIndex, 1)
    assert.equal(progress().completedStageIds.length, 1)
    const saved = structuredClone(s.quests.getSnapshot().progress)
    s.quests.restoreState(saved)
    collect(order[0])
    assert.deepEqual(s.quests.getSnapshot().progress, saved)
    collect(order[1])
    assert.equal(progress().stageIndex, 3)
    const quest = s.data.quests.find(q => q.id === questId)
    assert.match(quest.stages[3].description, /Defeat.*factory.*night/)
    s.inventory.grantItems([{ itemId: 'strange-key', quantity: 1 }])
    assert.equal(progress().stageIndex, 4)
  })
}

test('optional testimony lore checks skills without blocking core clues', () => {
  let level = 0
  const s = storySetup([], 'night', () => ({ erudition: level, stealth: level }))
  finishIrina(s)
  for (const [npc, choice] of clues) {
    s.open(npc)
    s.dialogue.chooseReply(choice)
    const account = s.dialogue.getSnapshot().conversation.text
    const lore = `${choice}-lore`
    const progress = structuredClone(s.quests.getSnapshot().progress)
    s.dialogue.chooseReply(lore)
    assert.equal(s.dialogue.getSnapshot().conversation.text, account)
    level = 8
    s.dialogue.chooseReply(lore)
    assert.notEqual(s.dialogue.getSnapshot().conversation.text, account)
    assert.deepEqual(s.quests.getSnapshot().progress, progress)
    level = 0
  }
})

test('Irina offers her escape clue only after her final factory quest', () => {
  const s = storySetup()
  const visible = () => s.dialogue.getSnapshot().conversation.choices
    .some(choice => choice.id === 'escape-night-shadow')
  s.restore(questId, 1)
  s.open('worker')
  assert.equal(visible(), false)
  s.dialogue.chooseReply('escape-night-shadow')
  assert.deepEqual(s.quests.getSnapshot().progress, [{ questId, stageIndex: 1 }])
  s.quests.restoreState([
    ...progressFor(s.data, 'factory-locked-workshop', 2),
    { questId, stageIndex: 1 },
  ])
  s.open('worker')
  assert.equal(visible(), false, 'the final report still needs completing')
  finishIrina(s)
  s.open('worker')
  assert.equal(visible(), true)
  s.dialogue.chooseReply('escape-night-shadow')
  assert.deepEqual(s.quests.getSnapshot().progress.find(q => q.questId === questId)
    .completedStageIds, ['night-shadow-clue'])
})

test('escape migration preserves old key recovery and finished departures', () => {
  const { data } = storySetup()
  for (const [old, current] of [[0, 0], [1, 1], [2, 4], [3, 5]]) {
    const save = { quests: [{ questId, stageIndex: old }] }
    migrateEscapeClues(save, data)
    assert.equal(save.quests[0].stageIndex, current)
    const migrated = structuredClone(save)
    migrateEscapeClues(save, data)
    assert.deepEqual(save, migrated)
  }
  const modern = { escapeCluesVersion: 1, quests: [{ questId, stageIndex: 1,
    completedStageIds: ['night-shadow-clue'] }] }
  const copy = structuredClone(modern)
  migrateEscapeClues(modern, data)
  assert.deepEqual(modern, copy)
})
