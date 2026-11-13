import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { emptyPerks, progressForAction, perkCharacter } from '../../src/domain/character/perks.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { conditionedCharacter } from '../../src/domain/skills/condition.ts'
import { PerksService } from '../../src/app/services/PerksService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'
import { LockpickingService } from '../../src/app/services/LockpickingService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

const data = content()
const definitions = data.ui.perks

test('alignment content rejects unknown actions, invalid points and misspelled skill modifiers', () => {
  for (const change of [
    perk => { perk.actionPoints.policeHit = 0 },
    perk => { perk.actionPoints.lockPicked = 1.5 },
    perk => { perk.actionPoints.policeMissed = 2 },
    perk => { perk.skillModifiers.intimidate = 2 },
    perk => { perk.itemIds = ['spirits'] },
  ]) {
    const invalid = structuredClone(data)
    change(invalid.ui.perks.find(perk => perk.id === 'unlawful'))
    assert.throws(() => validateContent(invalid), /perks/)
  }
})

test('authored actions score independently, cap at 50 and permanently lock the opposing alignment', () => {
  let state = emptyPerks()
  for (const [action, points] of Object.entries({ lockPicked: 5, policeHit: 2, policeKilled: 10, policeEngaged: 1 })) {
    const before = state.counts.unlawful ?? 0
    state = progressForAction(state, definitions, action)
    assert.equal(state.counts.unlawful, before + points)
  }
  for (const action of ['itemSold', 'dialogueChosen', 'questFinished']) state = progressForAction(state, definitions, action)
  assert.equal(state.counts.lawful, 13)
  assert.deepEqual(state.acquired, [])
  for (let i = 0; i < 4; i++) state = progressForAction(state, definitions, 'questFinished')
  assert.equal(state.counts.lawful, 50)
  assert.deepEqual(state.acquired, ['lawful'])
  assert.equal(progressForAction(state, definitions, 'policeKilled'), state)
  assert.equal(progressForAction(state, definitions, 'questFinished'), state)
})

test('both alignment bonuses survive carried gear and conditions without stacking or mutating the base', () => {
  const base = createCharacter({ id: 'test', name: 'Test', attributes: { strength: 4, agility: 4, intelligence: 4, willpower: 4, charisma: 4 }, startingItems: [] })
  for (const id of ['lawful', 'unlawful']) {
    const state = { ...emptyPerks(), counts: { [id]: 50 }, acquired: [id] }
    const effective = perkCharacter(base, state, [], definitions)
    const resolve = character => conditionedCharacter(character, [{ itemId: 'badge', quantity: 1 }], { badge: { id: 'badge', bonuses: [{ skill: 'persuasion', amount: 1 }] } }, { energy: 20, sanity: 20 }, { energy: 100, sanity: 100 })
    const normal = resolve(base), modified = resolve(effective)
    const sign = id === 'lawful' ? 1 : -1
    assert.equal(modified.skills.persuasion, normal.skills.persuasion + 2 * sign)
    assert.equal(modified.skills.intimidation, normal.skills.intimidation - 2 * sign)
    assert.deepEqual(resolve(perkCharacter(effective, state, [], definitions)).skills, modified.skills)
    assert.equal(base.skills.persuasion, 12)
  }
})

test('alignment service reloads progress, notifies once and never causes withdrawal', () => {
  const time = new DayTime(1, 'night'), notices = []
  const service = new PerksService(definitions, time, { drain() { assert.fail('alignment has no withdrawal') } }, undefined, message => notices.push(message))
  for (let i = 0; i < 9; i++) service.recordAction('lockPicked')
  const restored = new PerksService(definitions, time, { drain() { assert.fail('alignment has no withdrawal') } }, JSON.parse(JSON.stringify(service.getSnapshot())), message => notices.push(message))
  restored.recordAction('lockPicked')
  restored.recordAction('policeKilled')
  time.nextMorning()
  assert.deepEqual(restored.getSnapshot().acquired, ['unlawful'])
  assert.equal(notices.length, 1)
  assert.deepEqual(restored.getSnapshot().habits, {})
})

test('sales score only committed vendor units including zero-price goods; storage and failed sales do not', () => {
  let sold = 0
  const inventory = new InventoryService([{ id: 'junk', price: 1, maxStack: 5 }, { id: 'key', saleable: false }], [
    { id: 'shop', name: 'Shop', locationId: 'center', vendor: true, items: [] },
    { id: 'stash', name: 'Stash', locationId: 'center', items: [] },
  ], () => 0, [{ itemId: 'junk', quantity: 2 }, { itemId: 'key', quantity: 1 }], undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => sold++)
  inventory.openContainer('shop')
  inventory.storeItem('key')
  inventory.storeItem('missing')
  assert.equal(sold, 0)
  inventory.storeItem('junk', 0)
  assert.equal(sold, 1)
  inventory.closeMenu()
  inventory.openContainer('stash')
  inventory.storeItem('junk')
  assert.equal(sold, 1)
})

test('only accepted dialogue choices and completed quests invoke scoring', () => {
  let chosen = 0, finished = 0
  const dialogue = new DialogueService(undefined, undefined, undefined, () => chosen++)
  dialogue.openDialogue('Test', { start: 'hello', nodes: { hello: { text: 'Hello', choices: [{ id: 'bye', text: 'Bye', close: true }] } } })
  dialogue.chooseReply('invalid')
  assert.equal(chosen, 0)
  dialogue.chooseReply('bye')
  dialogue.chooseReply('bye')
  assert.equal(chosen, 1)
  const inventory = new InventoryService([{ id: 'junk' }], [])
  const quests = new QuestService([{ id: 'test', name: 'Test', description: 'Test', stages: [{ id: 'talk', description: 'Talk', trigger: { kind: 'dialogue', npcId: 'npc', choiceId: 'finish' } }] }], inventory, undefined, undefined, undefined, () => finished++)
  quests.openBoard()
  quests.accept('test')
  assert.equal(quests.advanceDialogue('test', 'npc', 'invalid'), false)
  assert.equal(finished, 0)
  assert.equal(quests.advanceDialogue('test', 'npc', 'finish'), true)
  assert.equal(quests.advanceDialogue('test', 'npc', 'finish'), false)
  assert.equal(finished, 1)
})

test('a rejected sale payment awards no points and preserves inventory', () => {
  let sold = 0
  const inventory = new InventoryService([{ id: 'junk', price: 202, maxStack: 5 }], [
    { id: 'shop', name: 'Shop', locationId: 'center', vendor: true, items: [] },
  ], () => 0, [{ itemId: 'junk', quantity: 2 }, ...Array.from({ length: 5 }, () => ({ itemId: 'junk', quantity: 5 }))], undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => sold++)
  inventory.openContainer('shop')
  const before = inventory.getSnapshot()
  inventory.storeItem('junk', 0)
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(sold, 0)
})

test('cancelled and failed locks award nothing; a successful puzzle awards once', () => {
  let picked = 0
  const locks = new LockpickingService(new DayTime(1, 'night'), () => 10, data.skills, { has: () => true, consume: () => true }, () => 0, () => 0, undefined, undefined, () => picked++)
  locks.attempt('door', 'Door')
  locks.close()
  assert.equal(picked, 0)
  locks.attempt('door', 'Door')
  locks.submit()
  assert.equal(picked, 0)
  locks.attempt('door', 'Door')
  const puzzle = locks.getSnapshot().puzzle
  locks.setNumber(0, puzzle.target - 2)
  locks.setNumber(1, 1)
  locks.setNumber(2, 1)
  locks.submit()
  locks.submit()
  assert.equal(picked, 1)
})
