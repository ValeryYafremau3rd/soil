import test from 'node:test'
import assert from 'node:assert/strict'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { resolveQuestMoney } from '../../src/domain/quests/quests.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { content } from '../helpers/content.mjs'

test('quest cash is the weighted skill total, rounded down, preserving item-only rewards', () => {
  const quest = { reward: { money: 200, items: [{ itemId: 'rope', quantity: 1 }] } }
  assert.deepEqual(resolveQuestMoney(quest, { barter: 10, intimidation: 4, persuasion: 6 }).reward,
    { money: 15, items: quest.reward.items })
  assert.equal(resolveQuestMoney(quest, { persuasion: 3 }).reward.money, 1)
  assert.equal(resolveQuestMoney(quest, {}).reward.money, 0)
  assert.equal(resolveQuestMoney(quest, { barter: -10 }).reward.money, 0)
  const itemOnly = { reward: { items: quest.reward.items } }
  assert.equal(resolveQuestMoney(itemOnly, { barter: 20 }), itemOnly)
})

test('quest payout uses current skills, retries atomically and pays only once', () => {
  let skills = { barter: 10, intimidation: 4, persuasion: 6 }
  let capacity = false
  const payments = []
  const inventory = { getSnapshot: () => ({ items: [] }), subscribe: () => () => {}, removeItems: () => true,
    tryExchangeItems: (_removed, _granted, money) => { if (!capacity) return false; payments.push(money); return true } }
  const definitions = [{ id: 'job', name: 'Job', offeredBy: 'giver', reward: { money: 200 },
    stages: [{ id: 'done', trigger: { kind: 'dialogue', npcId: 'giver', choiceId: 'finish' } }] }]
  const quests = new QuestService(definitions, inventory, undefined, undefined, undefined, undefined, undefined, () => skills)
  assert.equal(quests.definitions[0].reward.money, 15)
  quests.acceptFromNpc('job', 'giver')
  assert.equal(quests.advanceDialogue('job', 'giver', 'finish'), false)
  assert.equal(quests.isCompleted('job'), false)
  skills = { barter: 11, intimidation: 5, persuasion: 6 }
  assert.equal(quests.definitions[0].reward.money, 16)
  capacity = true
  assert.equal(quests.advanceDialogue('job', 'giver', 'finish'), true)
  assert.equal(quests.advanceDialogue('job', 'giver', 'finish'), false)
  assert.deepEqual(payments, [16])
})

test('calculated cash must fit in carried inventory before completion commits', () => {
  const data = content()
  const items = ['rope', 'wrench', 'pliers', 'cloth', 'letter', 'postcard'].map(itemId => ({ itemId, quantity: 1 }))
  const inventory = new InventoryService(data.items, [], () => 0, items)
  const definitions = [{ id: 'job', name: 'Job', offeredBy: 'giver', reward: { money: 200 },
    stages: [{ id: 'done', trigger: { kind: 'dialogue', npcId: 'giver', choiceId: 'finish' } }] }]
  const quests = new QuestService(definitions, inventory, undefined, undefined, undefined, undefined, undefined,
    () => ({ barter: 10, intimidation: 4, persuasion: 6 }))
  quests.acceptFromNpc('job', 'giver')
  const before = inventory.getSnapshot()
  assert.equal(quests.advanceDialogue('job', 'giver', 'finish'), false)
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(quests.isCompleted('job'), false)
  inventory.removeItems([{ itemId: 'cloth', quantity: 1 }])
  assert.equal(quests.advanceDialogue('job', 'giver', 'finish'), true)
  assert.equal(inventory.getSnapshot().money, 15)
  assert.equal(quests.advanceDialogue('job', 'giver', 'finish'), false)
})
