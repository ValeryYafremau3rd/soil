import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyStory, progressFor, storySetup } from '../helpers/story.mjs'

test('Pavel offer opens a briefing and leads through negotiation to a usable official exit', () => {
  let barter = 11
  const session = storySetup([], 'night', () => ({ barter }))
  session.quests.restoreState(progressFor(session.data, 'prologue-government-exit', 0)
    .filter(entry => entry.questId !== 'prologue-government-exit'))
  session.quests.startInitialQuests()
  session.quests.visitLocation('center')
  session.story.restoreState(emptyStory())
  session.open('citizen-clerk')
  session.dialogue.chooseReply('prologue-government-exit-offer')
  assert.equal(session.quests.isActive('prologue-government-exit'), true)
  assert.match(session.dialogue.getSnapshot().conversation.text, /checkpoint.*Center/)
  session.dialogue.chooseReply('government-exit-request')
  const progress = structuredClone(session.quests.getSnapshot().progress)
  session.dialogue.chooseReply('government-exit-negotiate')
  assert.match(session.dialogue.getSnapshot().conversation.text, /Barter.*requirement/)
  assert.deepEqual(session.quests.getSnapshot().progress, progress)
  assert.equal(session.story.getSnapshot().decisions.government_exit_bargain, undefined)
  session.dialogue.chooseReply('back')
  assert.ok(session.dialogue.getSnapshot().conversation.choices.some(choice =>
    choice.id === 'decision-topic-government_exit_bargain'))
  session.dialogue.chooseReply('decision-topic-government_exit_bargain')
  barter = 14
  session.dialogue.chooseReply('government-exit-negotiate')
  assert.equal(session.story.getSnapshot().decisions.government_exit_bargain, 'accept')
  assert.match(session.dialogue.getSnapshot().conversation.text, /inventory slot free/)
  assert.equal(session.inventory.getSnapshot().items.some(item => item.itemId === 'exit-permit'), false)
  session.dialogue.closeDialogue()
  assert.equal(session.story.interact('checkpoint-handoff'), true)
  assert.equal(session.inventory.getSnapshot().items.some(item => item.itemId === 'exit-permit'), true)
  session.dialogue.closeDialogue()
  assert.equal(session.story.interact('district-official-checkpoint'), true)
  assert.equal(session.story.getSnapshot().flags.ending_route, 'official')
  assert.equal(session.story.getSnapshot().flags.prologue_complete, true)
})

test('an already accepted first-stage save resumes directly into Pavel decision branch', () => {
  const session = storySetup([], 'night', () => ({ barter: 14 }))
  session.restore('prologue-government-exit', 0)
  session.open('citizen-clerk')
  session.dialogue.chooseReply('government-exit-request')
  assert.ok(session.dialogue.getSnapshot().conversation.choices.some(choice =>
    choice.id === 'government-exit-negotiate'))
  assert.equal(session.story.getSnapshot().decisions.government_exit_bargain, undefined)
})
