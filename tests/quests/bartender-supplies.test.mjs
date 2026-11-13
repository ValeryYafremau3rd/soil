import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'

const id = 'bartender-supplies'
const stack = itemId => ({ itemId, quantity: 1 })
function setup(items = []) {
  const data = content()
  const inventory = new InventoryService(data.items, [], () => 0, items)
  const quests = new QuestService(data.quests, inventory)
  const dialogue = new DialogueService(() => {}, {
    canChoose: (npc, choice) => quests.canAdvanceDialogue(choice.questId, npc, choice.id),
    choose: (npc, choice) => quests.advanceDialogue(choice.questId, npc, choice.id),
    canOffer: quests.canOffer, acceptFromNpc: quests.acceptFromNpc,
  })
  const talk = () => dialogue.openDialogue('Viktor', data.dialogues.bartender, 'bartender')
  const deliver = () => quests.advanceDialogue(id, 'bartender', 'deliver-supplies')
  const progress = () => quests.getSnapshot().progress.find(q => q.questId === id)
  return { inventory, quests, dialogue, talk, deliver, progress }
}

for (const [first, second, objective] of [['wine', 'bread', 'collect-alcohol'], ['tinned-beef', 'cider', 'collect-food']]) {
  test(`bartender tracks ${first} before ${second}, restores progress and pays once`, () => {
    const { inventory, quests, dialogue, talk, deliver, progress } = setup()
    talk(); dialogue.chooseReply('ask-for-job'); dialogue.chooseReply('back')
    assert.equal(progress(), undefined, 'declining does not accept')
    dialogue.chooseReply('ask-for-job'); dialogue.chooseReply('accept-supplies')
    assert.equal(progress().stageIndex, 0)
    assert.equal(quests.getBoardQuests().some(q => q.id === id), false)
    inventory.grantItems([stack('matchbox')])
    assert.equal(progress().completedStageIds, undefined)
    inventory.grantItems([stack(first)])
    assert.deepEqual(progress().completedStageIds, [objective])
    quests.restoreState(quests.getSnapshot().progress)
    inventory.grantItems([stack(second)])
    assert.equal(progress().stageIndex, 2)
    inventory.removeItems([stack(first)])
    assert.equal(deliver(), false, 'hand-in rechecks carried supplies')
    inventory.grantItems([stack(first)])
    assert.equal(quests.advanceDialogue(id, 'cashier', 'deliver-supplies'), false)
    assert.equal(deliver(), true)
    assert.equal(quests.isCompleted(id), true)
    assert.equal(inventory.getSnapshot().items.find(s => s.itemId === 'money')?.quantity, 10)
    assert.ok(inventory.getSnapshot().items.some(s => s.itemId === 'frying-pan') || inventory.getSnapshot().equipment.melee === 'frying-pan')
    assert.equal(inventory.getSnapshot().items.some(s => [first, second].includes(s.itemId)), false)
    assert.equal(deliver(), false)
    assert.equal(quests.acceptFromNpc(id, 'bartender'), false)
  })
}

test('already carried supplies count; full rewards reject hand-in atomically and allow retry', () => {
  const { inventory, quests, deliver, progress } = setup([
    { itemId: 'bread', quantity: 2 }, stack('wine'), stack('rope'), stack('matchbox'),
    stack('leather-journal'), stack('red-cigarettes'),
  ])
  assert.equal(quests.acceptFromNpc(id, 'bartender'), true)
  assert.equal(progress().stageIndex, 2)
  const before = inventory.getSnapshot()
  assert.equal(deliver(), false)
  assert.equal(inventory.getSnapshot(), before)
  inventory.removeItems([stack('rope'), stack('matchbox')])
  assert.equal(deliver(), true)
  assert.equal(inventory.getSnapshot().items.find(s => s.itemId === 'bread')?.quantity, 1)
})
