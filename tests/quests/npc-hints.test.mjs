import test from 'node:test'
import assert from 'node:assert/strict'
import { storySetup } from '../helpers/story.mjs'
import { getNpcQuestHint } from '../../src/domain/dialogue/questHints.ts'

test('new NPC offers keep their authored overhead invitation', () => {
  const s = storySetup()
  assert.equal(getNpcQuestHint('worker', s.data.dialogues.worker, s.quests, s.story.canChoose),
    s.data.quests.find(quest => quest.id === 'mechanic-scrap').offerText)
})

test('Pavel hints for active orientation and work objectives, respecting the tutorial prerequisite', () => {
  const s = storySetup()
  s.quests.startInitialQuests()
  const hint = () => getNpcQuestHint('citizen-clerk', s.data.dialogues['citizen-clerk'],
    s.quests, s.story.canChoose)
  assert.equal(hint(), s.data.quests.find(q => q.id === 'first-steps').name)
  s.quests.advanceDialogue('first-steps', 'citizen-clerk', 'first-steps-ask')
  assert.equal(hint(), null)
  s.quests.restoreState(s.quests.getSnapshot().progress.map(run => run.questId === 'first-steps'
    ? { ...run, stageIndex: s.data.quests.find(q => q.id === 'first-steps').stages.length } : run))
  assert.equal(hint(), s.data.quests.find(q => q.id === 'find-work').name)
  s.quests.advanceDialogue('find-work', 'citizen-clerk', 'find-work-ask')
  assert.equal(hint(), null)
})

test('active hand-in hints recheck carried items and vanish after finishing', () => {
  const s = storySetup()
  s.restore('cashier-1', 1)
  const hint = () => getNpcQuestHint('bartender', s.data.dialogues.bartender,
    { ...s.quests, definitions: s.quests.definitions, getOffer: () => null }, s.story.canChoose)
  assert.equal(hint(), null)
  s.inventory.grantItems([{ itemId: 'beer-bottle', quantity: 1 }])
  assert.equal(hint(), s.data.quests.find(q => q.id === 'cashier-1').name)
  s.quests.advanceDialogue('cashier-1', 'bartender', 'cashier-1-deliver-0')
  assert.equal(hint(), null)
})
