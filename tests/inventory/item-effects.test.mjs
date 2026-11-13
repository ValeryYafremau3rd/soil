import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'
import { normalizeStacks, transferItem } from '../../src/domain/inventory/loot.ts'
import { applyCarriedBonuses } from '../../src/domain/inventory/items.ts'
import { createCharacter, calculateSkills } from '../../src/domain/skills/character.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue } from '../helpers/content.mjs'
import { resolveSkillEffects } from '../../src/domain/skills/effects.ts'

test('authored weapons grant carried bonuses and retain active-use requirements', () => {
  const { items, skills: rates } = catalogue().data
  const trained = createCharacter({ id: 'trained', name: 'Trained', attributes: {
    strength: 5, agility: 5, intelligence: 5, willpower: 5, charisma: 5,
  }, startingItems: [] })
  for (const id of ['knife', 'hatchet', 'crowbar', 'barbed-bat', 'brass-knuckles', 'revolver', 'compact-pistol', 'service-pistol']) {
    const item = items.find(item => item.id === id)
    const skill = item.firearm ? 'weapons' : 'martialArts'
    const damage = item.firearm ? 'rangedDamage' : 'meleeDamage'
    assert.ok(item.skillRequirements[skill] > 1, id)
    assert.ok(item.bonus.skill === skill || item.bonus.attribute === 'agility', id)
    const definitions = { [id]: item }
    const below = { ...trained, baseAttributes: { ...trained.baseAttributes, strength: 1, agility: 1, intelligence: 2, willpower: 1 } }
    const untrained = applyCarriedBonuses(below, [], definitions, 0.2)
    assert.ok(applyCarriedBonuses(below, [stack(id)], definitions, 0.2).skills[skill] >= untrained.skills[skill])
    const boosted = applyCarriedBonuses(trained, [stack(id), stack(id)], definitions)
    assert.equal(boosted.skills[skill], item.bonus.attribute ? calculateSkills({ ...trained.attributes, [item.bonus.attribute]: trained.attributes[item.bonus.attribute] + item.bonus.amount })[skill] : trained.skills[skill] + item.bonus.amount, id)
    assert.ok(resolveSkillEffects(boosted.skills, rates)[damage] > resolveSkillEffects(trained.skills, rates)[damage], id)
    assert.deepEqual(applyCarriedBonuses(boosted, [], definitions), trained, `${id} bonus ends on removal`)
  }
})

const definitions = [
  { id: 'food', consumable: true, maxStack: 5, recovery: { energy: 30, sanity: 10 } },
  { id: 'med', consumable: true, maxStack: 5, recovery: { health: 30 } },
  { id: 'charm', bonus: { attribute: 'strength', amount: 1 } },
  { id: 'book', bonus: { skill: 'scraper', amount: 3 } },
]
const rules = Object.fromEntries(definitions.map(item => [item.id, item]))
const limits = id => rules[id]?.maxStack ?? 1
const stack = (itemId, quantity = 1) => ({ itemId, quantity })
const base = createCharacter({ id: 'test', name: 'Test', attributes: {
  strength: 2, agility: 3, intelligence: 4, willpower: 2, charisma: 1,
}, startingItems: [] })

test('attribute and skill bonuses remain active in bag slots and stop when stored', () => {
  const gear = [...definitions, { id: 'bag', inventorySlots: 3 },
    ...Array.from({ length: 5 }, (_, index) => ({ id: `filler${index}` }))]
  const byId = Object.fromEntries(gear.map(item => [item.id, item]))
  const service = new InventoryService(gear,
    [{ id: 'stash', name: 'Stash', locationId: 'test', items: [] }], () => 0,
    [stack('bag'), ...Array.from({ length: 5 }, (_, index) => stack(`filler${index}`)), stack('charm'), stack('book')])
  const equipped = () => applyCarriedBonuses(base, service.getSnapshot().items, byId)
  const expected = applyCarriedBonuses(base, [stack('charm'), stack('book')], byId)
  assert.deepEqual(service.getSnapshot().items.slice(6), [stack('charm'), stack('book')])
  assert.deepEqual(equipped(), expected)

  service.openContainer('stash')
  service.storeItem('filler0', 1)
  assert.deepEqual(equipped(), expected, 'shifting between base and bag slots preserves bonuses')
  service.storeItem('charm', 5)
  assert.deepEqual(equipped(), applyCarriedBonuses(base, [stack('book')], byId))
  service.storeItem('book', 5)
  assert.deepEqual(equipped(), base, 'stored items grant no carried bonuses')
  service.takeAll()
  assert.deepEqual(equipped(), expected, 'taking items back restores bonuses without accumulating them')
})

test('requirements block repeated use without spending items or restoring health, then allow the exact threshold', () => {
  let erudition = 4
  const messages = []
  const status = new StatusService()
  const service = new InventoryService([{ ...definitions[1], eruditionRequired: 5 }], [], () => 0,
    [stack('med', 2)], status, undefined, undefined, text => messages.push(text), () => erudition)
  service.openInventory()
  service.useItem(0)
  service.useItem(0)
  assert.equal(service.consumeItem('med'), false)
  assert.equal(messages.length, 3)
  assert.equal(messages[0], 'Requires Erudition 5')
  assert.equal(status.getSnapshot().health, 50)
  assert.equal(service.getSnapshot().items[0].quantity, 2)
  erudition = 5
  service.useItem(0)
  assert.equal(status.getSnapshot().health, 80)
  assert.equal(service.getSnapshot().items[0].quantity, 1)
})

test('books give carried bonuses regardless of requirements and Erudition caps at 20', () => {
  const books = {
    primer: { id: 'primer', eruditionRequired: 10, bonus: { skill: 'erudition', amount: 10 } },
    advanced: { id: 'advanced', eruditionRequired: 20, bonus: { attribute: 'intelligence', amount: 3 } },
    locked: { id: 'locked', eruditionRequired: 15, bonus: { skill: 'erudition', amount: 10 } },
  }
  assert.equal(applyCarriedBonuses(base, [stack('locked')], books).skills.erudition, 20)
  const boosted = applyCarriedBonuses(base, [stack('advanced'), stack('primer')], books)
  assert.equal(boosted.attributes.intelligence, 7)
  assert.equal(boosted.skills.erudition, 20)
  assert.deepEqual(applyCarriedBonuses(boosted, [], books), base)
  assert.equal(calculateSkills({ ...base.attributes, intelligence: 10 }).erudition, 22, 'raw derived skill is capped only when resolving carried equipment')
})

test('authored tools grant passive bonuses while unmet requirements block attempted use', () => {
  const { items } = catalogue().data
  for (const id of ['screwdriver', 'brass-knuckles', 'tool-roll']) {
    const definition = items.find(item => item.id === id)
    const character = createCharacter({ id: 'untrained', name: 'Untrained', attributes: {
      strength: 1, agility: 1, intelligence: 1, willpower: 1, charisma: 1,
    }, startingItems: [] })
    const untrained = applyCarriedBonuses(character, [], {}, 0.2)
    const carried = applyCarriedBonuses(character, [stack(id)], { [id]: definition }, 0.2)
    assert.ok(carried.skills.scraper >= untrained.skills.scraper)
    if (definition.bonus.attribute) assert.equal(carried.attributes[definition.bonus.attribute], character.attributes[definition.bonus.attribute] + definition.bonus.amount)
    const messages = []
    const inventory = new InventoryService([definition], [], () => 0, [stack(id)],
      undefined, undefined, undefined, text => messages.push(text), () => untrained.skills.erudition)
    inventory.openInventory()
    inventory.useItem(0)
    assert.match(messages[0], /Requires (Erudition|Scraper|Martial Arts)/)
    assert.equal(inventory.getSnapshot().items.length, 1)
  }
})

test('normalization splits consumables into fives and nonconsumables into single items', () => {
  assert.deepEqual(normalizeStacks([stack('food', 12), stack('charm', 2)], limits), [
    stack('food', 5), stack('food', 5), stack('food', 2), stack('charm'), stack('charm'),
  ])
})

test('a full inventory accepts only what fits in partial stacks and leaves the exact overflow', () => {
  const inventory = [stack('food', 4), ...Array.from({ length: 5 }, () => stack('charm'))]
  const source = [stack('food', 5)]
  const result = transferItem(inventory, source, 'food', 6, limits)
  assert.equal(result.inventory.length, 6)
  assert.equal(result.inventory[0].quantity, 5)
  assert.deepEqual(result.remaining, [stack('food', 4)])
  assert.equal(inventory[0].quantity, 4)
  assert.equal(source[0].quantity, 5)
})

test('slot-aware transfers move the chosen duplicate stack and preserve all other stacks', () => {
  const service = new InventoryService(definitions, [{
    id: 'crate', name: 'Crate', locationId: 'test', items: [stack('food', 8)],
  }], () => 0)
  service.openContainer('crate')
  service.takeItem('food', 1)
  assert.deepEqual(service.getSnapshot().items, [stack('food', 3)])
  assert.deepEqual(service.getSnapshot().containers.crate.items, [stack('food', 5)])
  service.takeItem('food', 0)
  assert.deepEqual(service.getSnapshot().items, [stack('food', 5), stack('food', 3)])
  service.storeItem('food', 1)
  assert.deepEqual(service.getSnapshot().items, [stack('food', 5)])
  assert.deepEqual(service.getSnapshot().containers.crate.items, [stack('food', 3)])
})

test('carried bonuses apply once per type, recalculate derived skills, and disappear on removal', () => {
  const boosted = applyCarriedBonuses(base, [stack('charm'), stack('charm'), stack('book')], rules)
  assert.equal(boosted.attributes.strength, base.attributes.strength + 1)
  assert.equal(boosted.skills.martialArts, base.skills.martialArts + 2)
  assert.equal(boosted.skills.scraper, calculateSkills(boosted.attributes).scraper + 3)
  assert.equal(rules.charm.bonus.amount, 1, 'the authored item bonus stays unchanged')
  assert.deepEqual(applyCarriedBonuses(boosted, [], rules), base, 'never accumulate bonuses across recomputation')
  assert.deepEqual(base.attributes, base.baseAttributes)
  const service = new InventoryService(definitions, [{ id: 'crate', name: 'Crate', locationId: 'test', items: [] }], () => 0,
    [stack('charm'), stack('charm')])
  service.openContainer('crate')
  service.storeItem('charm', 1)
  assert.equal(applyCarriedBonuses(base, service.getSnapshot().items, rules).attributes.strength, 3)
  service.storeItem('charm', 0)
  assert.equal(applyCarriedBonuses(base, service.getSnapshot().items, rules).attributes.strength, 2)
})

test('consuming one item restores the configured vitals, caps at 100, and consumes at maximum', () => {
  const status = new StatusService()
  status.restoreState({ health: 50, energy: 50, sanity: 50 })
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 50, sanity: 50 })
  const service = new InventoryService(definitions, [], () => 0, [stack('med', 5), stack('food', 5)], status)
  service.openInventory()
  service.useItem(0)
  assert.equal(status.getSnapshot().health, 80)
  assert.equal(service.getSnapshot().items[0].quantity, 4)
  service.useItem(0)
  assert.equal(status.getSnapshot().health, 100)
  service.useItem(0)
  assert.equal(service.getSnapshot().items[0].quantity, 2, 'consumes one even when health is full')
  for (let use = 0; use < 5; use++) service.useItem(1)
  assert.deepEqual(status.getSnapshot(), { health: 100, energy: 100, sanity: 100 })
  assert.equal(service.getSnapshot().items.length, 1)
  service.useItem(-1)
  service.useItem(99)
  assert.equal(service.getSnapshot().items[0].quantity, 2)
})

test('ordinary consumables work repeatedly at full vitals with or without the inventory open', () => {
  for (const vital of ['health', 'sanity', 'energy']) {
    const status = new StatusService()
    const full = { health: 100, sanity: 100, energy: 100 }
    status.restoreState(full)
    const inventory = new InventoryService([
      { id: 'item', consumable: true, maxStack: 5, recovery: { [vital]: 10 } },
    ], [], () => 0, [stack('item', 2)], status)
    inventory.useItem(0)
    assert.deepEqual(inventory.getSnapshot().items, [stack('item')])
    inventory.openInventory()
    inventory.useItem(0)
    inventory.useItem(0)
    assert.deepEqual(inventory.getSnapshot().items, [])
    assert.deepEqual(status.getSnapshot(), full)
  }
})

test('containers cannot be consumed, and using the last unit releases its inventory slot', () => {
  const status = new StatusService()
  const service = new InventoryService(definitions, [{ id: 'crate', name: 'Crate', locationId: 'test', items: [stack('med')] }],
    () => 0, [stack('charm'), stack('food')], status)
  service.openContainer('crate')
  service.useItem(0)
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 50, sanity: 50 })
  service.useItem(1)
  assert.deepEqual(service.getSnapshot().items, [stack('charm')])
  assert.equal(service.getSnapshot().containers.crate.items[0].quantity, 1)
})

test('configuration rejects invalid bonuses, limits, recovery effects, and vital maxima', () => {
  for (const patch of [
    { bonus: { attribute: 'strength', amount: 4 } }, { bonus: { attribute: 'unknown', amount: 1 } },
    { bonus: { skill: 'medicine', amount: 11 } }, { bonus: { skill: 'medicine', amount: 0 } },
    { eruditionRequired: 0 }, { eruditionRequired: 21 }, { eruditionRequired: 1.5 },
    { bonus: { attribute: 'strength', skill: 'medicine', amount: 1 } },
    { consumable: true, maxStack: 6 }, { consumable: false, maxStack: 5 },
    { consumable: true, recovery: { health: -1 } }, { consumable: false, recovery: { health: 20 } },
    { consumable: true, recovery: {} },
  ]) {
    const { data, sources } = catalogue()
    const item = data.items.find(item => item.id === 'crowbar')
    Object.assign(item, patch)
    assert.throws(() => validateContent(data, sources), /items.*crowbar/)
  }
  const { data, sources } = catalogue()
  data.ui.stats[0].max = 0
  assert.throws(() => validateContent(data, sources), /stats/)
})
