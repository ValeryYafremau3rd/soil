import assert from 'node:assert/strict'
import test from 'node:test'
import { storySetup } from '../helpers/story.mjs'

const cases = [
  { decision: 'dusan_fate', quest: 'factory-locked-workshop', stage: 2, npc: 'worker',
    good: 'factory-workshop-report', bad: 'factory-workshop-report-report',
    skill: 'persuasion', level: 14, result: 'warn', items: [] },
  { decision: 'patient_records_fate', quest: 'hospital-no-visitors', stage: 2, npc: 'stranger',
    good: 'hospital-no-visitors-decision', bad: 'hospital-no-visitors-decision-expose',
    skill: 'erudition', level: 16, result: 'copy', items: [] },
  { decision: 'apartment_evidence_choice', quest: 'clerk-apartment-evidence', stage: 1,
    npc: 'citizen-clerk', good: 'apartment-evidence-report-conceal',
    bad: 'apartment-evidence-report', skill: 'stealth', level: 14, result: 'conceal',
    items: [{ itemId: 'suspicious-correspondence', quantity: 1 }] },
  { decision: 'government_exit_bargain', quest: 'prologue-government-exit', stage: 1,
    npc: 'citizen-clerk', good: 'government-exit-negotiate',
    bad: 'government-exit-negotiate-refuse', skill: 'barter', level: 14,
    result: 'accept', items: [] },
]

for (const entry of cases) {
  test(`${entry.decision} uses one reversible topic and rechecks its positive skill gate`, () => {
    let level = entry.level - 1
    const session = storySetup(entry.items, 'night', () => ({ [entry.skill]: level }))
    session.restore(entry.quest, entry.stage)
    session.open(entry.npc)
    const root = session.dialogue.getSnapshot().conversation.choices
    const topic = `decision-topic-${entry.decision}`
    assert.equal(root.filter(choice => choice.id === topic).length, 1)
    assert.equal(root.some(choice => choice.id === entry.good || choice.id === entry.bad), false)
    const progress = structuredClone(session.quests.getSnapshot().progress)
    session.dialogue.chooseReply(topic)
    assert.deepEqual(session.quests.getSnapshot().progress, progress)
    assert.deepEqual(session.story.getSnapshot().decisions, {})
    const choices = session.dialogue.getSnapshot().conversation.choices
    assert.ok(choices.some(choice => choice.id === entry.good
      && choice.text.includes(`${level}/${entry.level}`)))
    session.dialogue.chooseReply('back')
    assert.deepEqual(session.quests.getSnapshot().progress, progress)
    level = entry.level
    session.dialogue.chooseReply(topic)
    level--
    session.dialogue.chooseReply(entry.good)
    assert.deepEqual(session.quests.getSnapshot().progress, progress)
    level = entry.level
    session.dialogue.chooseReply(entry.good)
    assert.equal(session.story.getSnapshot().decisions[entry.decision], entry.result)
    const decided = structuredClone(session.story.getSnapshot())
    session.dialogue.chooseReply(entry.good)
    assert.deepEqual(session.story.getSnapshot(), decided)
    session.open(entry.npc)
    assert.equal(session.dialogue.getSnapshot().conversation.choices
      .some(choice => choice.id === topic), false)
  })

  test(`${entry.decision} leaves its negative alternative available with zero skills`, () => {
    const session = storySetup(entry.items)
    session.restore(entry.quest, entry.stage)
    session.open(entry.npc)
    session.dialogue.chooseReply(`decision-topic-${entry.decision}`)
    const choice = session.dialogue.getSnapshot().conversation.choices
      .find(choice => choice.id === entry.bad)
    assert.ok(choice)
    assert.equal(choice.text.includes('/'), false)
    session.dialogue.chooseReply(entry.bad)
    assert.ok(session.story.getSnapshot().decisions[entry.decision])
  })

  test(`${entry.decision} hides its topic before the decision stage is ready`, () => {
    const session = storySetup()
    session.restore(entry.quest, entry.stage - 1)
    session.open(entry.npc)
    const before = structuredClone(session.quests.getSnapshot().progress)
    const topic = `decision-topic-${entry.decision}`
    assert.equal(session.dialogue.getSnapshot().conversation.choices
      .some(choice => choice.id === topic), false)
    session.dialogue.chooseReply(topic)
    assert.deepEqual(session.quests.getSnapshot().progress, before)
  })
}

test('the middle records outcome requires Diplomacy 12, between free exposure and Education 16', () => {
  let diplomacy = 11
  const session = storySetup([], 'night', () => ({ persuasion: diplomacy }))
  session.restore('hospital-no-visitors', 2)
  session.open('stranger')
  session.dialogue.chooseReply('decision-topic-patient_records_fate')
  const reply = 'hospital-no-visitors-decision-pavel'
  assert.ok(session.dialogue.getSnapshot().conversation.choices.find(choice =>
    choice.id === reply).text.includes('11/12'))
  session.dialogue.chooseReply(reply)
  assert.equal(session.story.getSnapshot().decisions.patient_records_fate, undefined)
  diplomacy = 12
  session.dialogue.chooseReply(reply)
  assert.equal(session.story.getSnapshot().decisions.patient_records_fate, 'pavel')
})
