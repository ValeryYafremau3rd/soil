import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { buffFearResistance, buffVitals, consumeForPerks, emptyPerks, perkCharacter, perkRecovery, perkWithdrawal } from '../../src/domain/character/perks.ts'
import { resolveFearResistance } from '../../src/domain/inventory/items.ts'
import { fearDamage } from '../../src/domain/combat/patrolCombat.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { attributeVitals } from '../../src/domain/skills/vitals.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { PerksService } from '../../src/app/services/PerksService.ts'
import { RestService } from '../../src/app/services/RestService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'

const { ui, items } = content()
const definitions = ui.perks

test('alcohol grants day-long fear resistance, refreshes without stacking and preserves other buffs', () => {
  const time = new DayTime(1, 'night')
  const perks = new PerksService(definitions, time, { drain() {} }, undefined, undefined, ui.consumableBuffs)
  const resistance = () => buffFearResistance(perks.getSnapshot(), ui.consumableBuffs)
  assert.equal(resistance(), 0)
  perks.consumed('steroids', { health: 10 })
  for (const id of definitions.find(perk => perk.id === 'alcohol-addiction').itemIds) {
    perks.consumed(id, { sanity: 10 })
    assert.equal(resistance(), { spirits:60, 'beer-bottle':5, 'canned-beer':5, cider:5, wine:12, vodka:40, whiskey:40 }[id], id)
    assert.equal(perks.getSnapshot().buffs.length, 7)
  }
  assert.equal(fearDamage(20, resistance()), 12)
  assert.equal(resolveFearResistance([{ itemId: 'charm', quantity: 1 }], { charm: { id: 'charm', fearResistance: 30 } }, {}, resistance()), 70)
  assert.equal(resolveFearResistance([], {}, {}, 150), 100)
  time.nextMorning()
  perks.consumed('vodka', { sanity: 10 })
  const restored = new PerksService(definitions, time, { drain() {} }, structuredClone(perks.getSnapshot()), undefined, ui.consumableBuffs)
  for (let phase = 0; phase < 3; phase++) time.advance()
  assert.equal(resistance(), 40)
  time.nextMorning()
  assert.equal(resistance(), 0)
  assert.equal(buffFearResistance(restored.getSnapshot(), ui.consumableBuffs), 0)
})

test('steroids require training, spend one unit and refresh both day-long bonuses without stacking', () => {
  const time = new DayTime(1, 'night')
  const status = new StatusService()
  const perks = new PerksService(definitions, time, status, undefined, undefined, ui.consumableBuffs)
  status.setItemEffects(perks)
  let medicine = 0
  const inventory = new InventoryService(items, [], () => 0, [{ itemId: 'steroids', quantity: 3 }], status,
    undefined, undefined, undefined, () => 1, false, undefined, undefined, () => ({ medicine }))
  const character = createCharacter({ id: 'test', name: 'Test', attributes: {
    strength: 3, agility: 3, intelligence: 3, willpower: 3, charisma: 3,
  }, startingItems: [] })
  const attributes = () => perkCharacter(character, perks.getSnapshot(), ui.consumableBuffs).attributes
  inventory.openInventory()
  inventory.useItem(0)
  assert.equal(inventory.getSnapshot().items[0].quantity, 3)
  assert.equal(perks.getSnapshot().buffs, undefined)
  medicine = 10
  inventory.useItem(0)
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  assert.equal(attributes().strength, 5)
  assert.equal(attributes().agility, 4)
  time.nextMorning()
  inventory.useItem(0)
  assert.equal(inventory.getSnapshot().items[0].quantity, 1)
  assert.equal(perks.getSnapshot().buffs.length, 4)
  assert.equal(attributes().strength, 5)
  assert.equal(attributes().agility, 4)
  const saved = structuredClone(perks.getSnapshot())
  const restored = new PerksService(definitions, time, status, saved, undefined, ui.consumableBuffs)
  for (let phase = 0; phase < 3; phase++) time.advance()
  assert.equal(attributes().strength, 5)
  assert.equal(attributes().agility, 4)
  time.nextMorning()
  assert.equal(attributes().strength, 3)
  assert.equal(attributes().agility, 3)
  assert.deepEqual(restored.getSnapshot().buffs, [])
})

test('addiction boost lasts four phases across morning; repeat use refreshes it; legacy values normalize', () => {
  const time = new DayTime(1, 'night')
  const perks = new PerksService(definitions, time, { drain() {} })
  for (let n = 0; n < 10; n++) perks.consumed('spirits', { sanity: 25 })
  time.nextMorning()
  assert.equal(perks.getSnapshot().habits['alcohol-addiction'].willpower, 1)
  time.advance()
  time.advance()
  assert.equal(perks.getSnapshot().habits['alcohol-addiction'].willpower, 1)
  time.advance()
  assert.equal(perks.getSnapshot().habits['alcohol-addiction'].willpower, -1)
  perks.consumed('spirits', { sanity: 25 })
  assert.equal(perks.getSnapshot().habits['alcohol-addiction'].willpower, 1)
  const saved = structuredClone(perks.getSnapshot())
  saved.habits['alcohol-addiction'].willpower = 2
  const restored = new PerksService(definitions, time, { drain() {} }, saved)
  assert.equal(restored.getSnapshot().habits['alcohol-addiction'].willpower, 1)
})

test('consumable buffs coexist, refresh without stacking, expire through sleep and restore remaining duration', () => {
  const time = new DayTime(1, 'night')
  const status = new StatusService()
  const perks = new PerksService(definitions, time, status, undefined, undefined, ui.consumableBuffs)
  status.setItemEffects(perks)
  const character = createCharacter({ id: 'test', name: 'Test', attributes: {
    strength: 3, agility: 3, intelligence: 3, willpower: 3, charisma: 3,
  }, startingItems: [] })
  const effective = () => perkCharacter(character, perks.getSnapshot(), ui.consumableBuffs)
  perks.subscribe(() => status.setLimits(attributeVitals(ui.stats, effective().attributes)))
  perks.consumed('white-tablets', { sanity: 20 })
  perks.consumed('red-tablets', { health: 20, sanity: 15 })
  assert.equal(effective().attributes.intelligence, 3)
  assert.equal(effective().skills.medicine, 9)
  assert.equal(effective().attributes.strength, 3)
  assert.equal(status.getSnapshot().health, 100, 'buff cap increases do not heal')
  time.nextMorning()
  assert.equal(perks.getSnapshot().buffs.length, 5, 'morning is only one elapsed phase')
  perks.consumed('white-tablets', { sanity: 20 })
  assert.equal(effective().attributes.intelligence, 3)
  assert.equal(perks.getSnapshot().buffs.length, 5)
  status.restoreState({ health: 120, energy: 100, sanity: 120 })
  time.advance()
  time.advance()
  const saved = JSON.parse(JSON.stringify(perks.getSnapshot()))
  const restoredTime = new DayTime(2, 'evening')
  const restored = new PerksService(definitions, restoredTime, { drain() {} }, saved, undefined, ui.consumableBuffs)
  restoredTime.advance()
  assert.deepEqual(restored.getSnapshot().buffs.map(buff => buff.id), ['calm', 'tablet-fatigue'])
  time.advance()
  assert.equal(effective().attributes.strength, 2)
  assert.equal(status.getSnapshot().health, 110, 'expired strength clamps excess Health')
  restoredTime.nextMorning()
  time.nextMorning()
  assert.deepEqual(restored.getSnapshot().buffs, [])
  assert.equal(effective().attributes.intelligence, 3)
  assert.equal(status.getSnapshot().sanity, 115)
})

test('food buffs raise Health/Energy caps without filling them, refresh as a group and clamp on expiry', () => {
  const status = new StatusService()
  const time = new DayTime()
  const perks = new PerksService(definitions, time, status, undefined, undefined, ui.consumableBuffs)
  perks.subscribe(() => status.setLimits(buffVitals(ui.stats, perks.getSnapshot(), ui.consumableBuffs)))
  perks.consumed('tinned-beef', { energy: 15, sanity: 3 })
  perks.consumed('bread', { energy: 20 })
  assert.equal(status.getLimits().health, 110)
  assert.equal(status.getLimits().energy, 115)
  assert.equal(status.getSnapshot().health, 100)
  assert.equal(status.getSnapshot().energy, 100)
  time.advance()
  perks.consumed('canned-fish', { energy: 15 })
  assert.equal(status.getLimits().health, 110, 'same food group refreshes without stacking')
  status.restoreState({ health: 110, energy: 115, sanity: 100 })
  time.nextMorning()
  assert.equal(status.getLimits().energy, 100)
  assert.equal(status.getSnapshot().energy, 100)
  assert.equal(status.getLimits().health, 110)
  time.advance()
  assert.equal(status.getLimits().health, 100)
  assert.equal(status.getSnapshot().health, 100)
})

test('buff items can be used at full vitals only with requirements met, and spend one unit', () => {
  const status = new StatusService()
  const time = new DayTime()
  const perks = new PerksService(definitions, time, status, undefined, undefined, ui.consumableBuffs)
  status.setItemEffects(perks)
  let medicine = 0
  const inventory = new InventoryService(items, [], () => 0, [{ itemId: 'white-tablets', quantity: 2 }], status,
    undefined, undefined, undefined, () => 1, false, undefined, undefined, () => ({ medicine }))
  inventory.openInventory()
  inventory.useItem(0)
  assert.equal(perks.getSnapshot().buffs, undefined)
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  medicine = 20
  inventory.useItem(0)
  assert.equal(perks.getSnapshot().buffs[0].id, 'calm')
  assert.equal(inventory.getSnapshot().items[0].quantity, 1)
})

test('buff config validates references, unique IDs, bounded nonzero amounts and duration', () => {
  for (const change of [
    data => { data.ui.consumableBuffs[0].itemIds = ['missing'] },
    data => { data.ui.consumableBuffs[0].id = data.ui.perks[0].id },
    data => { data.ui.consumableBuffs[0].amount = 0 },
    data => { data.ui.consumableBuffs.find(buff => buff.attribute).amount = 4 },
    data => { data.ui.consumableBuffs.find(buff => buff.attribute).amount = -4 },
    data => { data.ui.consumableBuffs[0].amount = -1 },
    data => { data.ui.consumableBuffs[0].durationDays = 0 },
    data => { data.ui.consumableBuffs[0].attribute = 'strength' },
    data => { delete data.ui.consumableBuffs[0].vital },
  ]) {
    const data = content()
    change(data)
    assert.throws(() => validateContent(data), /consumableBuffs/)
  }
})

test('first goal wins across item variants, remains permanent, and affects only matching Sanity', () => {
  for (const winner of definitions.filter(perk => !perk.actionPoints)) {
    let state = emptyPerks()
    const loser = definitions.find(perk => perk.group === winner.group && perk.id !== winner.id)
    for (let n = 0; n < 9; n++) {
      state = consumeForPerks(state, definitions, loser.itemIds[0], 8, 0)
      state = consumeForPerks(state, definitions, winner.itemIds[n % winner.itemIds.length], 8, 0)
    }
    assert.deepEqual(state.acquired, [])
    state = consumeForPerks(state, definitions, winner.itemIds[0], 8, 0)
    state = consumeForPerks(state, definitions, loser.itemIds[0], 8, 0)
    assert.deepEqual(state.acquired, [winner.id])
    assert.deepEqual(perkRecovery(state, definitions, winner.itemIds[0], { sanity: 8, health: 3 }), { sanity: 16, health: 3 })
    assert.deepEqual(perkRecovery(state, definitions, loser.itemIds[0], { sanity: 8 }), { sanity: 8 })
  }
})

test('withdrawal waits a full day, repeats once daily, handles skipped phases and resets on use', () => {
  let state = emptyPerks()
  for (let n = 0; n < 10; n++) state = consumeForPerks(state, definitions, 'spirits', 25, 2)
  assert.equal(perkWithdrawal(state, definitions, 5, 4).sanity, 0)
  let result = perkWithdrawal(state, definitions, 6, 4)
  assert.equal(result.sanity, 12.5)
  assert.equal(perkWithdrawal(result.state, definitions, 6, 4).sanity, 0)
  result = perkWithdrawal(result.state, definitions, 14, 4)
  assert.equal(result.sanity, 25)
  state = consumeForPerks(result.state, definitions, 'spirits', 25, 15)
  assert.equal(perkWithdrawal(state, definitions, 18, 4).sanity, 0)
  assert.equal(perkWithdrawal(state, definitions, 19, 4).sanity, 12.5)
})

test('failed requirements do not count; full-status substance use spends one; previews and Medicine scale once', () => {
  const status = new StatusService(undefined, () => 1.5)
  status.restoreState({ health: 100, energy: 100, sanity: 100 })
  const time = new DayTime()
  const perks = new PerksService(definitions, time, status)
  status.setItemEffects(perks)
  let education = 0
  const inventory = new InventoryService(items, [], () => 0, [{ itemId: 'spirits', quantity: 2 }], status,
    undefined, undefined, undefined, () => education)
  inventory.openInventory()
  inventory.useItem(0)
  inventory.useItem(0)
  assert.deepEqual(perks.getSnapshot(), emptyPerks())
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  education = 2
  inventory.useItem(0)
  assert.equal(perks.getSnapshot().counts['alcohol-addiction'], 1)
  assert.equal(inventory.getSnapshot().items[0].quantity, 1)
  assert.equal(status.getSnapshot().sanity, 100)
  for (let n = 1; n < 10; n++) perks.consumed('spirits', { sanity: 25 })
  assert.equal(status.getRecovery(status.getItemRecovery({ sanity: 25 }, 'spirits')).sanity, 75)
  status.drain({ sanity: 70 })
  const before = status.getSnapshot().sanity
  inventory.useItem(0)
  assert.equal(status.getSnapshot().sanity, Math.min(100, before + 75))
})

test('vendor-bought spirits work at full Sanity; ordinary recovery stays unchanged; dead heroes cannot consume', () => {
  const status = new StatusService()
  status.restoreState({ health: 100, energy: 100, sanity: 100 })
  const time = new DayTime()
  const perks = new PerksService(definitions, time, status)
  status.setItemEffects(perks)
  const inventory = new InventoryService(items, [{ id: 'shop', name: 'Shop', locationId: 'test', vendor: true,
    items: [{ itemId: 'spirits', quantity: 2 }] }], () => 0, [{ itemId: 'money', quantity: 100 }], status,
    undefined, undefined, undefined, () => 20, false, undefined, undefined, () => ({ athletics: 20 }))
  inventory.openContainer('shop')
  const price = inventory.getPrice('spirits')
  inventory.takeItem('spirits', 0)
  assert.equal(inventory.getSnapshot().money, 100 - price)
  assert.equal(inventory.getSnapshot().containers.shop.items[0].quantity, 1)
  inventory.openInventory()
  inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === 'spirits'))
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'spirits'), false)
  assert.equal(perks.getSnapshot().counts['alcohol-addiction'], 1)
  assert.equal(status.getSnapshot().sanity, 100)
  assert.equal(status.canConsumeAtMaximum('bandage'), true)
  assert.equal(status.recover({ health: 25 }), false)
  for (const id of ['red-cigarettes', 'grey-cigarettes', 'beer-bottle', 'canned-beer']) assert.equal(status.canConsumeAtMaximum(id), true)
  status.restoreState({ health: 0, energy: 100, sanity: 0 })
  inventory.grantItems([{ itemId: 'spirits', quantity: 1 }])
  inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === 'spirits'))
  assert.equal(perks.getSnapshot().counts['alcohol-addiction'], 1)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'spirits').quantity, 1)
})

test('saved progress resumes without granting duplicates or delaying withdrawal after reload', () => {
  const time = new DayTime(1, 'evening')
  const penalties = []
  let perks = new PerksService(definitions, time, { drain: value => penalties.push(value.sanity) })
  for (let n = 0; n < 10; n++) perks.consumed('spirits', { sanity: 25 })
  const saved = JSON.parse(JSON.stringify(perks.getSnapshot()))
  const restoredTime = new DayTime(2, 'afternoon')
  perks = new PerksService(definitions, restoredTime, { drain: value => penalties.push(value.sanity) }, saved)
  restoredTime.advance()
  assert.deepEqual(penalties, [12.5])
  assert.deepEqual(perks.getSnapshot().acquired, ['alcohol-addiction'])
  restoredTime.advance()
  assert.deepEqual(penalties, [12.5])
})

test('matching use sets Willpower +1 without stacking; a full day resets to normal -1 without cumulative loss or healing', () => {
  const character = createCharacter({ id: 'test', name: 'Test', attributes: {
    strength: 3, agility: 3, intelligence: 3, willpower: 3, charisma: 3,
  }, startingItems: [] })
  const time = new DayTime()
  const status = new StatusService()
  const perks = new PerksService(definitions, time, status)
  const effective = () => perkCharacter(character, perks.getSnapshot())
  perks.subscribe(() => status.setLimits(attributeVitals(ui.stats, effective().attributes)))
  status.restoreState({ health: 100, energy: 100, sanity: 80 })
  for (let n = 0; n < 10; n++) perks.consumed('spirits', { sanity: 25 })
  assert.equal(effective().attributes.willpower, 4)
  assert.equal(effective().skills.medicine, 10)
  assert.equal(status.getLimits().sanity, 120)
  assert.equal(status.getSnapshot().sanity, 80, 'higher limits never heal')
  perks.consumed('spirits', { sanity: 25 })
  assert.equal(effective().attributes.willpower, 4)
  status.restoreState({ health: 100, energy: 100, sanity: 125 })
  time.nextMorning()
  assert.equal(effective().attributes.willpower, 2)
  assert.equal(effective().skills.medicine, 8)
  assert.equal(status.getLimits().sanity, 110)
  assert.equal(status.getSnapshot().sanity, 97.5, 'cap clamps before daily withdrawal')
  time.nextMorning()
  assert.equal(effective().attributes.willpower, 2)
  perks.consumed('red-cigarettes', { sanity: 8 })
  assert.equal(effective().attributes.willpower, 2, 'competing substance gives no boost')
  perks.consumed('spirits', { sanity: 25 })
  assert.equal(effective().attributes.willpower, 4)
  assert.equal(character.baseAttributes.willpower, 3)
  const minimum = { ...character, baseAttributes: { ...character.baseAttributes, willpower: 1 } }
  time.nextMorning()
  assert.equal(perkCharacter(minimum, perks.getSnapshot()).attributes.willpower, 0)
})


test('consumable tradeoffs refresh, clamp attributes, and completed sleep clears all effects but not addictions', () => {
  const time = new DayTime()
  const status = new StatusService()
  const perks = new PerksService(definitions, time, status, undefined, undefined, ui.consumableBuffs)
  status.setItemEffects(perks)
  const character = createCharacter({ id: 'test', name: 'Test', attributes: {
    strength: 1, agility: 1, intelligence: 1, willpower: 3, charisma: 3,
  }, startingItems: [] })
  const effective = () => perkCharacter(character, perks.getSnapshot(), ui.consumableBuffs).attributes
  const inventory = new InventoryService(items, [], () => 0, [{ itemId: 'spirits', quantity: 2 }, { itemId: 'white-tablets', quantity: 2 }], status,
    undefined, undefined, undefined, () => 20, false, undefined, undefined, () => ({ medicine: 20 }))
  status.drain({ energy: 30 })
  status.restoreState({ health: 80, energy: 70, sanity: 100 })
  inventory.useItem(0)
  assert.equal(status.getSnapshot().energy, 85)
  assert.equal(effective().intelligence, 0)
  assert.equal(effective().agility, 0)
  inventory.useItem(1)
  assert.equal(status.getSnapshot().health, 80, 'advanced medicine does not heal')
  assert.equal(effective().strength, 0)
  assert.equal(perks.getSnapshot().counts['alcohol-addiction'], 1)
  const rest = new RestService(time, status, { rest: 0, sleep: 0 }, perks.clearTimedEffects)
  rest.open('sleep', 'Bed')
  rest.close()
  assert.equal(perks.getSnapshot().buffs.length, 5, 'cancel preserves effects')
  rest.open('rest', 'Bench')
  rest.confirm(1)
  assert.equal(perks.getSnapshot().buffs.length, 5, 'rest preserves effects')
  rest.open('sleep', 'Bed')
  rest.confirm(1)
  assert.deepEqual(perks.getSnapshot().buffs, [])
  assert.equal(perks.getSnapshot().counts['alcohol-addiction'], 1)
  assert.deepEqual(effective(), character.attributes)
  rest.confirm(1)
  assert.deepEqual(perks.getSnapshot().buffs, [])
})

test('cigarettes favor concentration over physique; food provides small immediate health recovery', () => {
  const time = new DayTime()
  const perks = new PerksService(definitions, time, { drain() {} }, undefined, undefined, ui.consumableBuffs)
  const character = createCharacter({ id: 'test', name: 'Test', attributes: {
    strength: 3, agility: 3, intelligence: 3, willpower: 3, charisma: 3,
  }, startingItems: [] })
  for (const id of ['red-cigarettes', 'grey-cigarettes']) perks.consumed(id, { sanity: 8 })
  const effective = perkCharacter(character, perks.getSnapshot(), ui.consumableBuffs)
  assert.equal(effective.attributes.agility, 4)
  assert.equal(effective.attributes.strength, 2)
  assert.equal(perks.getSnapshot().buffs.length, 2)
  for (const item of items.filter(item => item.category === 'Food' && item.recovery)) assert.equal(item.recovery.health, 3)
})
