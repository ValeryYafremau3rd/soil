import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'

/** Create real quest services with phase-aware letter pickup and dialogue skills. */
function setup() {
  const data = content()
  const time = new DayTimeService()
  let quests
  let barter = 7
  const inventory = new InventoryService(
    data.items, buildContainerSeeds(data.containers, data.items), () => 0, [],
    undefined, undefined, undefined, () => {}, () => 20, false, () => true,
    () => 10, () => ({}), undefined, undefined,
    (id, item) => quests.canTakeDeliveryItem(id, item),
  )
  quests = new QuestService(data.quests, inventory, () => {}, time, () => 0, () => {}, () => 0, () => ({ barter: 8 }))
  const dialogue = new DialogueService(() => {}, {
    skill: () => barter,
    canChoose: (npc, choice) => quests.canAdvanceDialogue(choice.questId, npc, choice.id),
    choose: (npc, choice) => quests.advanceDialogue(choice.questId, npc, choice.id),
    canOffer: quests.canOffer, acceptFromNpc: quests.acceptFromNpc,
  })
  return { data, time, inventory, quests, dialogue, setBarter: value => { barter = value } }
}

test('Viktor shortages follow Running low, preserve the normal route and recheck Barter 8', () => {
  const { data, quests, dialogue, inventory, setBarter } = setup()
  const id = 'bartender-shortages'
  assert.equal(quests.acceptFromNpc(id, 'bartender'), false)
  quests.restoreState([{ questId: 'bartender-supplies', stageIndex: 3 }])
  assert.equal(quests.acceptFromNpc(id, 'bartender'), true)
  assert.equal(quests.advanceDialogue(id, 'citizen-clerk', 'shortages-clerk'), false)
  assert.equal(quests.advanceDialogue(id, 'cashier', 'shortages-cashier'), true)
  dialogue.openDialogue('Pavel', data.dialogues['citizen-clerk'], 'citizen-clerk')
  dialogue.chooseReply('shortages-clerk')
  assert.match(dialogue.getSnapshot().conversation.text, /informed the capital/)
  dialogue.chooseReply('shortages-barter')
  assert.match(dialogue.getSnapshot().conversation.text, /informed the capital/)
  setBarter(8)
  dialogue.chooseReply('shortages-barter')
  assert.match(dialogue.getSnapshot().conversation.text, /militia and soldiers/)
  assert.equal(quests.advanceDialogue(id, 'bartender', 'shortages-report'), true)
  assert.equal(inventory.getSnapshot().money, quests.definitions.find(q => q.id === id).reward.money)
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'enamel-mug'))
  assert.equal(quests.advanceDialogue(id, 'bartender', 'shortages-report'), false)
})

test('letter requires nighttime pickup, showing Viktor and nighttime return before payment', () => {
  const { quests, inventory, time } = setup()
  const id = 'bartender-letter'
  assert.equal(quests.acceptFromNpc(id, 'bartender'), false)
  quests.restoreState([
    { questId: 'bartender-shortages', stageIndex: 3 },
    { questId: 'cashier-3', stageIndex: 3 },
  ])
  assert.equal(quests.acceptFromNpc(id, 'bartender'), true)
  inventory.openContainer('center-post')
  inventory.takeItem('clerk-report')
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'clerk-report'), false)
  time.advance(); time.advance(); time.advance()
  inventory.takeItem('clerk-report')
  assert.equal(quests.advanceDialogue(id, 'bartender', 'letter-finish'), false)
  const saved = quests.getSnapshot().progress
  quests.restoreState(saved)
  assert.equal(quests.advanceDialogue(id, 'bartender', 'letter-show'), true)
  time.advance()
  inventory.openContainer('center-post')
  inventory.storeItem('clerk-report')
  assert.equal(quests.advanceDialogue(id, 'bartender', 'letter-finish'), false)
  inventory.takeItem('clerk-report')
  time.advance(); time.advance(); time.advance()
  inventory.storeItem('clerk-report')
  assert.equal(quests.advanceDialogue(id, 'bartender', 'letter-finish'), true)
  assert.equal(inventory.getSnapshot().money, quests.definitions.find(q => q.id === id).reward.money)
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'barbed-bat')
    || inventory.getSnapshot().equipment.melee === 'barbed-bat')
  assert.equal(quests.advanceDialogue(id, 'bartender', 'letter-finish'), false)
})
