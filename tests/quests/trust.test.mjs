import test from 'node:test'
import assert from 'node:assert/strict'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'

test('effective persuasion adds trust in five-point steps and shares the quest cap', () => {
  let persuasion = 0
  const inventory = { getSnapshot: () => ({ items: [] }), subscribe: () => () => {},
    removeItems: () => true, tryExchangeItems: () => true }
  const definitions = [{ id: 'story', offeredBy: 'giver', stages: [{ id: 'done', trigger: { kind: 'accept' } }] }]
  const quests = new QuestService(definitions, inventory, undefined, undefined, undefined, undefined, () => persuasion)
  for (const [points, expected] of [[0, 1], [4, 1], [5, 2], [9, 2], [10, 3], [19, 4], [20, 5], [50, 5], [-5, 1]]) {
    persuasion = points
    assert.equal(quests.getTrust('giver'), expected, `Persuasion ${points}`)
  }
  quests.restoreState([{ questId: 'story', stageIndex: 1 }])
  persuasion = 15
  assert.equal(quests.getTrust('giver'), 5)
  assert.equal(quests.getTrust('other'), 4)
  persuasion = 5
  assert.equal(quests.getTrust('giver'), 3, 'current skill changes recalculate the bonus')
  assert.equal(quests.getTrust(''), 0)
})

test('trust counts finished unique non-radiant quests for their owner, caps at five and restores', () => {
  const definitions = Array.from({ length: 7 }, (_, index) => ({ id: `story-${index}`, offeredBy: 'giver',
    stages: [{ id: 'deliver', description: 'Deliver', trigger: { kind: 'dialogue', npcId: 'recipient', choiceId: 'deliver' } }] }))
  definitions.push({ ...definitions[0], id: 'radiant', repeatable: true })
  definitions.push({ ...definitions[0], id: 'board', offeredBy: undefined })
  let paymentAllowed = false
  const inventory = { getSnapshot: () => ({ items: [] }), subscribe: () => () => {}, removeItems: () => paymentAllowed,
    tryExchangeItems: () => paymentAllowed }
  definitions[0].reward = { money: 1 }
  const quests = new QuestService(definitions, inventory)
  assert.equal(quests.getTrust('giver'), 1)
  quests.acceptFromNpc('story-0', 'giver')
  assert.equal(quests.advanceDialogue('story-0', 'recipient', 'deliver'), false)
  assert.equal(quests.getTrust('giver'), 1, 'failed completion earns no trust')
  paymentAllowed = true
  assert.equal(quests.advanceDialogue('story-0', 'recipient', 'deliver'), true)
  assert.equal(quests.getTrust('giver'), 2)
  assert.equal(quests.getTrust('recipient'), 1)
  assert.equal(quests.advanceDialogue('story-0', 'recipient', 'deliver'), false)
  assert.equal(quests.getTrust('giver'), 2)
  const restored = new QuestService(definitions, inventory)
  restored.restoreState(quests.getSnapshot().progress)
  assert.equal(restored.getTrust('giver'), 2)
  quests.restoreState([{ questId: 'radiant', stageIndex: 1 }])
  assert.equal(quests.getTrust('giver'), 1)
  quests.restoreState(definitions.map(quest => ({ questId: quest.id, stageIndex: 1 })))
  assert.equal(quests.getTrust('giver'), 5)
  assert.equal(quests.getTrust('recipient'), 2, 'board requests credit their dialogue recipient')
  assert.equal(quests.getTrust('unknown'), 1)
  assert.equal(quests.getTrust(''), 0)
})

test('dialogue refreshes displayed trust immediately after completing a quest', () => {
  let trust = 0
  const dialogue = new DialogueService(undefined, { canChoose: () => true, choose: () => { trust++; return true },
    getTrust: npcId => npcId === 'giver' ? trust : 0 })
  const definition = { start: 'hello', nodes: {
    hello: { text: 'Hello', choices: [{ id: 'finish', text: 'Done', questId: 'story', next: 'thanks' }] },
    thanks: { text: 'Thanks', choices: [{ id: 'bye', text: 'Bye' }] },
  } }
  dialogue.openDialogue('Giver', definition, 'giver')
  assert.equal(dialogue.getSnapshot().conversation.trust, 0)
  dialogue.chooseReply('finish')
  assert.equal(dialogue.getSnapshot().conversation.trust, 1)
  dialogue.closeDialogue()
  dialogue.openDialogue('Other', definition, 'other')
  assert.equal(dialogue.getSnapshot().conversation.trust, 0)
})
