import test from 'node:test'
import assert from 'node:assert/strict'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

test('NPC follow-up quests unlock immediately after completion, including after reload', () => {
  const time = new DayTimeService()
  const definitions = ['first', 'second', 'other'].map((id, index) => ({
    id, name: id, offeredBy: index === 2 ? 'other-npc' : 'npc',
    ...(index === 1 ? { prerequisites: ['first'] } : {}),
    stages: [{ id: 'finish', trigger: { kind: 'dialogue', npcId: 'npc', choiceId: 'finish' } }],
  }))
  const inventory = {
    getSnapshot: () => ({ items: [] }), subscribe: () => () => {},
    removeItems: () => true, tryExchangeItems: () => true,
  }
  const quests = new QuestService(definitions, inventory, undefined, time)
  assert.equal(quests.acceptFromNpc('second', 'npc'), false)
  assert.equal(quests.acceptFromNpc('first', 'npc'), true)
  assert.equal(quests.advanceDialogue('first', 'npc', 'finish'), true)
  assert.equal(quests.canOffer('other', 'other-npc'), true)
  assert.equal(quests.canOffer('second', 'npc'), true)
  const saved = structuredClone(quests.getSnapshot())
  quests.restoreState(saved.progress, saved.courierBoard, saved.npcJobs)
  const dialogue = new DialogueService(undefined, {
    canChoose: () => true, choose: () => true,
    canOffer: quests.canOffer,
    acceptFromNpc: quests.acceptFromNpc,
  })
  dialogue.openDialogue('NPC', { start: 'hello', nodes: {
    hello: { text: 'Hello.', choices: [
      { id: 'accept', text: 'Next job?', acceptQuestId: 'second', next: 'accepted' },
    ] },
    accepted: { text: 'Accepted.', choices: [] },
  } }, 'npc')
  assert.ok(dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'accept'))
  dialogue.chooseReply('accept')
  assert.equal(dialogue.getSnapshot().conversation.text, 'Accepted.')
  assert.equal(quests.isActive('second'), true)
  assert.equal(time.getSnapshot().day, 1)
  assert.equal(time.getSnapshot().phase, 'morning')
  assert.equal(quests.acceptFromNpc('second', 'npc'), false)
})
