import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

const data = content()
function setup() {
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  return { inventory, quests }
}
const ask = quests => quests.advanceDialogue('first-steps', 'citizen-clerk', 'first-steps-ask')
const report = quests => quests.advanceDialogue('first-steps', 'citizen-clerk', 'first-steps-report')
function lessons(quests) {
  quests.visitRoom('living-district', 'apartments', 'apartment-21')
  for (const [action, item] of [['sleep'], ['rest'], ['bus'], ['buy', 'bread'], ['consume', 'bread'], ['buy', 'grey-cigarettes'], ['consume', 'grey-cigarettes']]) quests.recordAction(action, item)
}

test('tutorial ignores early/unrelated events, persists partial objectives, and pays stacks atomically once', () => {
  const { inventory, quests } = setup()
  lessons(quests)
  assert.equal(report(quests), false)
  inventory.grantItems(Array.from({ length: 6 }, () => ({ itemId: 'rope', quantity: 1 })))
  assert.equal(ask(quests), false)
  inventory.removeItems([{ itemId: 'rope', quantity: 1 }])
  assert.equal(ask(quests), true)
  assert.equal(ask(quests), false)
  assert.equal(inventory.getSnapshot().keyItems.includes('key-ring'), false)
  quests.recordAction('buy', 'rope')
  quests.recordAction('consume', 'rope')
  quests.recordAction('rest')
  const saved = structuredClone(quests.getSnapshot().progress)
  quests.restoreState(saved)
  assert.deepEqual(quests.getSnapshot().progress, saved)
  lessons(quests)
  assert.equal(report(quests), false)
  assert.equal(quests.isCompleted('first-steps'), false)
  inventory.removeItems(inventory.getSnapshot().items)
  assert.equal(report(quests), true)
  assert.equal(report(quests), false)
  assert.equal(inventory.getSnapshot().items.find(i => i.itemId === 'bread').quantity, 5)
  assert.equal(inventory.getSnapshot().items.find(i => i.itemId === 'grey-cigarettes').quantity, 10)
})

test('survey requires both starter quests, counts each person once, and rewards the star', () => {
  const { inventory, quests } = setup()
  assert.equal(quests.acceptFromNpc('town-opinions', 'citizen-clerk'), false)
  assert.equal(ask(quests), true)
  lessons(quests)
  assert.equal(report(quests), true)
  assert.equal(quests.acceptFromNpc('town-opinions', 'citizen-clerk'), false)
  inventory.removeItems(inventory.getSnapshot().items)
  const work = data.quests.find(q => q.id === 'find-work')
  quests.restoreState(quests.getSnapshot().progress.map(q => q.questId === work.id ? { ...q, stageIndex: work.stages.length } : q))
  assert.equal(quests.acceptFromNpc('town-opinions', 'citizen-clerk'), true)
  const survey = data.quests.find(q => q.id === 'town-opinions')
  assert.equal(quests.advanceDialogue(survey.id, 'citizen-clerk', 'town-opinions-report'), false)
  for (const stage of survey.stages.slice(0, -1).reverse()) {
    assert.equal(quests.advanceDialogue(survey.id, stage.trigger.npcId, stage.trigger.choiceId), true)
    assert.equal(quests.advanceDialogue(survey.id, stage.trigger.npcId, stage.trigger.choiceId), false)
    quests.restoreState(quests.getSnapshot().progress)
  }
  assert.equal(quests.advanceDialogue(survey.id, 'citizen-clerk', 'town-opinions-report'), true)
  assert.equal(quests.advanceDialogue(survey.id, 'citizen-clerk', 'town-opinions-report'), false)
  assert.equal(inventory.getSnapshot().items.find(i => i.itemId === 'red-star').quantity, 1)
})

for (const skill of ['persuasion', 'intimidation']) for (const level of [5, 6]) test(`${skill} survey answer requires six (${level})`, () => {
  const dialogue = new DialogueService(() => {}, { canChoose: () => true, choose: () => true }, () => {}, () => {},
    { skill: () => skill === 'intimidation' ? level : 0, day: () => 1, pay: () => true, notify: () => {} },
    { skill: () => skill === 'persuasion' ? level : 0, config: data.advice, day: () => 1, onAsked: () => {} })
  dialogue.openDialogue('Viktor', data.dialogues.bartender, 'bartender')
  dialogue.chooseReply('town-opinion')
  const id = skill === 'persuasion' ? 'town-honest-diplomacy' : 'town-honest-intimidation'
  assert.match(dialogue.getSnapshot().conversation.choices.find(c => c.id === id).text, new RegExp(`${level}/6`))
  dialogue.chooseReply(id)
  assert.equal(dialogue.getSnapshot().conversation.text.includes('not satisfied'), level >= 6)
})

test('tutorial purchases count successful vendor transfers, not failed purchases or free storage', () => {
  const definitions = [{ id: 'bread', price: 2, maxStack: 5 }, { id: 'rope' }]
  const inventory = new InventoryService(definitions, [
    { id: 'shop', name: 'Shop', vendor: true, locationId: 'center', items: [{ itemId: 'bread', quantity: 3 }] },
    { id: 'stash', name: 'Stash', locationId: 'center', items: [{ itemId: 'bread', quantity: 1 }] },
  ])
  const events = []
  inventory.onPurchased = id => events.push(id)
  inventory.openContainer('shop')
  inventory.takeItem('bread')
  inventory.takeAll()
  assert.deepEqual(events, [])
  inventory.grantItems([], 10)
  inventory.takeItem('bread')
  assert.deepEqual(events, ['bread'])
  inventory.openContainer('stash')
  inventory.takeItem('bread')
  assert.deepEqual(events, ['bread'])
})
