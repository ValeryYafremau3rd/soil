import test from 'node:test'
import assert from 'node:assert/strict'
import { storySetup, emptyStory } from '../helpers/story.mjs'
import { resolveNpcPlacements } from '../../src/app/content/resolveNpcPlacements.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, contentFiles } from '../helpers/content.mjs'
import { assembleContent } from '../../src/app/content/assembleContent.ts'

test('updated content is authoritative, metadata stays non-executable and the story graph validates', () => {
  const { data, sources } = catalogue()
  assert.doesNotThrow(() => validateContent(data, sources))
  assert.equal(sources['npcs.json.worker'], 'src/content/npc/worker.json')
  assert.equal(sources['quests.json.factory-missing-worker'], 'src/content/uests/factory-missing-worker.json')
  assert.equal(data.npcs.worker._codex, undefined)
  const files = contentFiles()
  files['./npcs/worker.json'].name = 'Retired content'
  files['./quests/way-out-of-town.json'].name = 'Retired quest'
  const next = assembleContent(files).data
  assert.notEqual(next.npcs.worker.name, 'Retired content')
  assert.notEqual(next.quests.find(q => q.id === 'way-out-of-town').name, 'Retired quest')
  assert.deepEqual(data.npcs.stranger.schedule.night.roomId, 'apartment-11')
  assert.match(data.dialogues.stranger.nodes['apartment-eleven'].text, /Dusan.*pistol cache/)
})

test('world clues cannot be completed by placeholder dialogue and retain night restrictions', () => {
  const { quests, restore, story, daytime, dialogue } = storySetup([], 'morning')
  restore('factory-missing-worker', 1)
  assert.equal(quests.advanceDialogue('factory-missing-worker', 'worker', 'factory-missing-worker-locker'), false)
  assert.equal(story.interact('factory-locker'), true)
  assert.equal(quests.getSnapshot().progress.find(p => p.questId === 'factory-missing-worker').stageIndex, 2)
  dialogue.closeDialogue()
  restore('prologue-last-night', 1)
  story.interact('factory-convoy-entry')
  assert.equal(quests.getSnapshot().progress.find(p => p.questId === 'prologue-last-night').stageIndex, 1)
  for (let phase = 0; phase < 3; phase++) daytime.advance()
  story.interact('factory-convoy-entry')
  assert.equal(quests.getSnapshot().progress.find(p => p.questId === 'prologue-last-night').stageIndex, 2)
})

test('Dusan report persists once, removes all schedules next day and leaves alternate clue recovery', () => {
  const s = storySetup()
  s.restore('factory-locked-workshop', 2)
  s.open('worker')
  s.dialogue.chooseReply('decision-topic-dusan_fate')
  s.dialogue.chooseReply('factory-workshop-report-report')
  assert.equal(s.story.getSnapshot().decisions.dusan_fate, 'report')
  assert.equal(s.story.isNpcAbsent('citizen-mechanic'), false)
  assert.equal(s.story.decide('dusan_fate', 'warn'), false)
  const saved = structuredClone(s.story.getSnapshot())
  s.story.restoreState(saved)
  s.daytime.advance(1)
  assert.equal(s.story.isNpcAbsent('citizen-mechanic'), true)
  assert.equal(s.story.getSnapshot().consequences.length, 0)
  for (const phase of ['morning', 'afternoon', 'evening', 'night']) {
    for (const location of s.data.locations) {
      assert.equal(resolveNpcPlacements(s.data.npcs, s.data.locations, location.id, phase,
        s.story.getSnapshot().absentNpcIds).some(npc => npc.type === 'citizen-mechanic'), false)
    }
  }
  s.quests.restoreState([{ questId: 'town-opinions', stageIndex: 0 }])
  assert.equal(s.story.interact('dusan-confiscation-notice'), true)
  assert.equal(s.dialogue.getSnapshot().conversation.npcId, 'citizen-mechanic')
  assert.equal(s.dialogue.getSnapshot().conversation.kind, 'investigation')
  const reply = s.dialogue.getSnapshot().conversation.choices.find(c => c.id !== 'close')
  assert.ok(reply)
  s.dialogue.chooseReply(reply.id)
  assert.ok(s.quests.getSnapshot().progress[0].completedStageIds.length)
  s.dialogue.openInvestigation({ start: 'clue', nodes: {
    clue: { text: 'An unrelated clue.', choices: [] },
  } })
  assert.equal(s.dialogue.getSnapshot().conversation.npcId, undefined)
})

for (const [value, absent] of [['copy', false], ['expose', true], ['pavel', false]]) {
  test(`patient records ${value} persists and applies only its selected next-day consequence`, () => {
    const s = storySetup([], 'night', () => ({ erudition: 16, persuasion: 12 }))
    s.restore('hospital-no-visitors', 2)
    s.open('stranger')
    s.dialogue.chooseReply('decision-topic-patient_records_fate')
    s.dialogue.chooseReply(value === 'copy' ? 'hospital-no-visitors-decision' : `hospital-no-visitors-decision-${value}`)
    assert.equal(s.story.getSnapshot().decisions.patient_records_fate, value)
    assert.equal(s.story.getSnapshot().flags.hospital_transfer_evidence, true)
    s.daytime.advance(1)
    assert.equal(s.story.isNpcAbsent('stranger'), absent)
    assert.equal(s.story.getSnapshot().consequences.length, 0)
  })
}

test('early decisions are rejected and legacy completed branches get safe defaults without replayed rewards', () => {
  const s = storySetup()
  s.restore('factory-locked-workshop', 0)
  assert.equal(s.story.decide('dusan_fate', 'report'), false)
  s.restore('factory-locked-workshop', 3)
  const before = s.inventory.getSnapshot()
  s.story.restoreState()
  assert.equal(s.story.getSnapshot().decisions.dusan_fate, 'warn')
  assert.equal(s.story.getSnapshot().flags.factory_access_evidence, true)
  assert.equal(s.inventory.getSnapshot(), before)
  s.story.restoreState(emptyStory())
})
