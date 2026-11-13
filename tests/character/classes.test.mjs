import assert from 'node:assert/strict'
import test from 'node:test'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { ATTRIBUTE_LABELS, calculateSkills, createCharacter, validateClasses } from '../../src/domain/skills/character.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { content } from '../helpers/content.mjs'
import { applyCarriedBonuses, itemBonuses, unmetItemRequirements } from '../../src/domain/inventory/items.ts'

const itemDefinitions = content().items
const itemIds = itemDefinitions.map(item => item.id)
const expected = [
  [6, 8, 8, 6, 5, 5, 4, 4, 6, 3, 4],
  [7, 5, 5, 8, 8, 5, 6, 6, 4, 4, 4],
  [4, 4, 4, 5, 6, 5, 5, 5, 5, 8, 7],
]

test('class attributes share a nine-point budget and support their criminal specialties', () => {
  const [burglar, safecracker, grifter] = classes.map(createCharacter)
  for (const character of [burglar, safecracker, grifter]) {
    assert.equal(Object.values(character.attributes).reduce((total, value) => total + value, 0), 9)
    assert.ok(Object.values(character.attributes).every(value => value >= 1))
  }
  assert.ok(burglar.skills.athletics > safecracker.skills.athletics)
  assert.ok(burglar.skills.martialArts > grifter.skills.martialArts)
  assert.ok(burglar.skills.stealth > grifter.skills.stealth)
  assert.ok(safecracker.skills.lockpicking > burglar.skills.lockpicking)
  assert.ok(safecracker.skills.erudition > burglar.skills.erudition)
  assert.ok(grifter.skills.persuasion > safecracker.skills.persuasion)
  assert.ok(grifter.skills.barter > burglar.skills.barter)
})

test('every attribute improves its own useful skills without reducing any others', () => {
  assert.equal(ATTRIBUTE_LABELS.willpower, 'Willpower')
  assert.equal(ATTRIBUTE_LABELS.strength, 'Physique')
  assert.equal(ATTRIBUTE_LABELS.agility, 'Concentration')
  const attributes = { strength: 1, agility: 1, intelligence: 1, willpower: 1, charisma: 1 }
  const base = calculateSkills(attributes)
  assert.ok(Object.values(base).every(value => value === 3))
  const roles = {
    strength: ['martialArts', 'athletics', 'scraper', 'intimidation'],
    agility: ['weapons', 'martialArts', 'athletics', 'stealth', 'lockpicking'],
    intelligence: ['lockpicking', 'scraper', 'medicine', 'erudition', 'persuasion'],
    willpower: ['weapons', 'stealth', 'medicine', 'erudition', 'intimidation', 'barter'],
    charisma: ['intimidation', 'persuasion', 'barter'],
  }
  for (const [attribute, skills] of Object.entries(roles)) {
    const increased = calculateSkills({ ...attributes, [attribute]: 2 })
    assert.deepEqual(Object.keys(base).filter(skill => increased[skill] > base[skill]), skills)
    assert.ok(Object.keys(base).every(skill => increased[skill] >= base[skill]))
  }
})

test('all three configured classes calculate the exact eleven skill values', () => {
  assert.deepEqual(classes.map(entry => entry.name), ['Burglar', 'Safecracker', 'Grifter'])
  classes.forEach((entry, index) => {
    assert.deepEqual(Object.values(calculateSkills(entry.attributes)), expected[index])
    const character = createCharacter(entry)
    assert.equal(character.classId, entry.id)
    assert.deepEqual(character.attributes, entry.attributes)
    assert.notEqual(character.attributes, entry.attributes)
  })
})

test('each class starts with its configured items and pickups respect stack limits', () => {
  validateClasses(classes, itemIds)
  for (const entry of classes) {
    const startingItems = entry.startingItems.map(itemId => ({ itemId, quantity: entry.startingItemQuantities?.[itemId] ?? 1 }))
    const service = new InventoryService(itemDefinitions, [{
      id: 'test', name: 'Test', locationId: 'test', items: [startingItems[0]],
    }], () => 0, startingItems)
    assert.deepEqual(service.getSnapshot().items, startingItems)
    service.removeItems([startingItems[1]])
    service.openContainer('test')
    service.takeAll()
    assert.equal(service.getSnapshot().items.filter(item => item.itemId === startingItems[0].itemId).reduce((sum, item) => sum + item.quantity, 0), startingItems[0].quantity * 2)
    assert.equal(startingItems[0].quantity, entry.startingItemQuantities?.[startingItems[0].itemId] ?? 1)
  }
})

test('starting kits fit six slots, add no attributes, and support each class supplies', () => {
  const definitions = Object.fromEntries(itemDefinitions.map(item => [item.id, item]))
  const kits = [
    ['crowbar', 'rope', 'canned-meat', 'stealth-training-magazine', 'key-ring', 'money'],
    ['lockpick', 'pliers', 'lockpicking-training-magazine', 'red-cigarettes', 'key-ring', 'money'],
    ['briefcase', 'medicine-training-magazine', 'postcard', 'medicine-bottle', 'key-ring', 'money'],
  ]
  classes.forEach((entry, index) => {
    assert.deepEqual(entry.startingItems, kits[index])
    const stacks = entry.startingItems.map(itemId => ({ itemId, quantity: entry.startingItemQuantities?.[itemId] ?? 1 }))
    const base = createCharacter(entry)
    const equipped = applyCarriedBonuses(base, stacks, definitions)
    assert.deepEqual(equipped.attributes, base.attributes)
    const inventory = new InventoryService(itemDefinitions, [], () => 0, stacks)
    assert.ok(inventory.getSnapshot().items.length <= 6)
    for (const { itemId } of stacks) {
      assert.ok(itemBonuses(definitions[itemId]).every(bonus => !bonus.attribute), itemId)
      assert.deepEqual(unmetItemRequirements(definitions[itemId], equipped.skills), [], itemId)
    }
    if (index === 0) {
      assert.deepEqual(unmetItemRequirements(definitions.crowbar, base.skills), [], 'crowbar needs no self-granted skill bonus')
      assert.equal(equipped.skills.martialArts, base.skills.martialArts + 2)
      assert.equal(stacks.find(stack => stack.itemId === 'canned-meat').quantity, 2)
    } else if (index === 1) {
      assert.equal(stacks.find(stack => stack.itemId === 'lockpick').quantity, 3)
      assert.equal(stacks.find(stack => stack.itemId === 'red-cigarettes').quantity, 2)
    } else {
      assert.equal(stacks.find(stack => stack.itemId === 'medicine-bottle').quantity, 2)
      assert.equal(itemBonuses(definitions.postcard).length, 0)
      assert.ok(definitions.postcard.price > 1)
      assert.ok(base.skills.barter >= definitions.postcard.skillRequirements.barter)
    }
  })
})

test('class validation rejects duplicate IDs, missing attributes, and invalid equipment', () => {
  const zero = { ...classes[0], attributes: { ...classes[0].attributes, intelligence: 0 } }
  assert.doesNotThrow(() => validateClasses([zero], itemIds))
  assert.throws(() => validateClasses([{ ...zero, attributes: { ...zero.attributes, intelligence: -1 } }], itemIds), /Invalid intelligence/)
  assert.throws(() => validateClasses([classes[0], classes[0]], itemIds), /unique/)
  assert.throws(() => validateClasses([{ ...classes[0], attributes: {} }], itemIds), /Invalid/)
  for (const startingItems of [[], ['crowbar', 'crowbar', 'crowbar'], ['crowbar', 'work-pass', 'missing']]) {
    assert.throws(() => validateClasses([{ ...classes[0], startingItems, startingItemQuantities: undefined }], itemIds), /distinct existing/)
  }
})

test('granting class equipment after world loading preserves container contents', () => {
  const service = new InventoryService(itemDefinitions, [{
    id: 'crate', name: 'Crate', locationId: 'test', items: [{ itemId: 'crowbar', quantity: 2 }],
  }])
  const containers = service.getSnapshot().containers
  const equipment = classes[0].startingItems.map(itemId => ({ itemId, quantity: 1 }))
  service.grantItems(equipment)
  assert.deepEqual(service.getSnapshot().items, equipment)
  assert.equal(service.getSnapshot().containers, containers)
  assert.equal(service.getSnapshot().menu, null)
})

