import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { emptyPerks, progressForAction, perkCharacter } from '../../src/domain/character/perks.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { conditionedCharacter } from '../../src/domain/skills/condition.ts'
import { PerksService } from '../../src/app/services/PerksService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'

const data = content(), definitions = data.ui.perks
const service = () => new PerksService(definitions, new DayTime(), { drain() {} })

test('each competing pair locks at its configured goal, with independent groups and no duplicate awards', () => {
  for (const [winner, action, repeats, loser] of [
    ['hoarder', 'itemScrapped', 5, 'scalper'],
    ['scalper', 'itemSold', 5, 'hoarder'], ['bruiser', 'policeFightStarted', 5, 'skulker'],
    ['skulker', 'policeHidden', 10, 'bruiser'], ['skulker', 'policeEscaped', 10, 'bruiser'],
    ['bruiser', 'monsterFightStarted', 5, 'skulker'],
    ['skulker', 'monsterHidden', 10, 'bruiser'], ['skulker', 'monsterEscaped', 10, 'bruiser'],
    ['nerd', 'adviceAsked', 10, 'punk'], ['punk', 'intimidated', 10, 'nerd'],
  ]) {
    let state = emptyPerks()
    for (let i = 0; i < repeats - 1; i++) state = progressForAction(state, definitions, action)
    assert.deepEqual(state.acquired, [])
    state = progressForAction(state, definitions, action)
    assert.equal(state.counts[winner], definitions.find(perk => perk.id === winner).goal)
    assert.deepEqual(state.acquired, [winner])
    const other = definitions.find(perk => perk.id === loser)
    for (let i = 0; i < 20; i++) state = progressForAction(state, definitions, Object.keys(other.actionPoints)[0])
    assert.deepEqual(state.acquired, [winner])
    assert.equal(state.counts[loser] ?? 0, 0)
  }
})

test('monster combat and stealth progress never change police reputation', () => {
  let state = emptyPerks()
  state = progressForAction(state, definitions, 'monsterFightStarted')
  state = progressForAction(state, definitions, 'monsterEscaped')
  state = progressForAction(state, definitions, 'monsterHidden')
  assert.equal(state.counts.bruiser, 2)
  assert.equal(state.counts.skulker, 2)
  assert.equal(state.counts.unlawful ?? 0, 0)
  assert.equal(state.counts.lawful ?? 0, 0)
})

test('alignment, possessions and combat style coexist and apply their exact modifiers through gear/conditions', () => {
  const base = createCharacter({ id: 'test', name: 'Test', attributes: { strength: 5, agility: 5, intelligence: 5, willpower: 5, charisma: 5 }, startingItems: [] })
  for (const ids of [['lawful', 'hoarder', 'bruiser'], ['unlawful', 'scalper', 'skulker']]) {
    const state = { ...emptyPerks(), acquired: ids, counts: Object.fromEntries(ids.map(id => [id, definitions.find(perk => perk.id === id).goal])) }
    const resolve = character => conditionedCharacter(character, [], {}, { energy: 100, sanity: 100 }, { energy: 100, sanity: 100 })
    const actual = resolve(perkCharacter(base, state, [], definitions)).skills, normal = resolve(base).skills
    for (const skill of Object.keys(normal)) {
      const bonus = ids.reduce((sum, id) => sum + (definitions.find(perk => perk.id === id).skillModifiers[skill] ?? 0), 0)
      assert.equal(actual[skill], normal[skill] + bonus, skill)
    }
    const restored = new PerksService(definitions, new DayTime(), { drain() {} }, JSON.parse(JSON.stringify(state)))
    assert.deepEqual(restored.getSnapshot().acquired, ids)
  }
})

test('accepted persuasive and intimidating dialogue adds the specific alignment point on top of ordinary dialogue', () => {
  const perks = service()
  const dialogue = new DialogueService(undefined, undefined, undefined, choice => {
    perks.recordAction('dialogueChosen')
    if (choice.approach) perks.recordAction(choice.approach === 'persuasion' ? 'persuaded' : 'intimidated')
  })
  for (const id of ['persuade-advice', 'intimidate-advice']) {
    dialogue.openDialogue('Milos', data.dialogues.stranger, 'stranger')
    dialogue.chooseReply('invalid')
    const before = perks.getSnapshot()
    dialogue.chooseReply(id)
    assert.notEqual(perks.getSnapshot(), before)
    const after = perks.getSnapshot()
    dialogue.chooseReply(id)
    assert.equal(perks.getSnapshot(), after)
  }
  assert.equal(perks.getSnapshot().counts.lawful, 3)
  assert.equal(perks.getSnapshot().counts.unlawful, 1)
})

test('loot, deposits, purchases and failed pickups do not progress Hoarder; sales progress both groups', () => {
  const perks = service()
  const inventory = new InventoryService([{ id: 'junk', price: 1, maxStack: 5 }], [
    { id: 'crate', name: 'Crate', locationId: 'test', items: [{ itemId: 'junk', quantity: 3 }] },
    { id: 'shop', name: 'Shop', locationId: 'test', vendor: true, items: [] },
  ], () => 0, [], undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => perks.recordAction('itemSold'))
  inventory.subscribeLoot(pickup => { for (const stack of pickup.items) for (let i = 0; i < stack.quantity; i++) perks.recordAction('itemLooted') })
  inventory.openContainer('crate')
  inventory.takeAll()
  assert.equal(perks.getSnapshot().counts.hoarder, undefined)
  inventory.storeItem('junk')
  inventory.takeAll()
  inventory.takeAll()
  assert.equal(perks.getSnapshot().counts.hoarder, undefined)
  inventory.closeMenu(); inventory.openContainer('shop')
  inventory.storeItem('junk')
  assert.equal(perks.getSnapshot().counts.scalper, 1)
  assert.equal(perks.getSnapshot().counts.lawful, 2)
  inventory.takeItem('junk')
  assert.equal(perks.getSnapshot().counts.hoarder, undefined)
})

test('scrapping awards one point only when an item is recovered; rejected and empty attempts award nothing', () => {
  for (const [skill, roll, points] of [[0, 0.99, 0], [0, 0, 1], [20, 0.99, 1]]) {
    const perks = service()
    const inventory = new InventoryService(data.items, [], () => roll, [{ itemId: 'bent-nails', quantity: 1 }], undefined, undefined, undefined, undefined, () => 20, false, undefined, () => skill, () => ({}), undefined, () => perks.recordAction('itemScrapped'))
    inventory.useItem(0)
    assert.equal(perks.getSnapshot().counts.hoarder, undefined)
    inventory.openInventory()
    inventory.useItem(0)
    assert.equal(perks.getSnapshot().counts.hoarder ?? 0, points)
    inventory.closeMenu()
    inventory.useItem(0)
    assert.equal(perks.getSnapshot().counts.hoarder ?? 0, points)
  }
})