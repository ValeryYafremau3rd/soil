import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { applyCarriedBonuses, activeBonusItems, itemBonuses } from '../../src/domain/inventory/items.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { migrateReadingInventory } from '../../src/app/persistence/migrateReading.ts'
import { roomContainerPlacements } from '../../src/app/content/roomContainerPlacements.ts'

const data = content()
const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
const base = createCharacter({ id: 'reader', name: 'Reader', attributes: { strength: 1, agility: 1, intelligence: 1, willpower: 1, charisma: 1 }, startingItems: [] })
const stack = itemId => ({ itemId, quantity: 1 })
const setup = (ids, erudition = 20) => new InventoryService(data.items, [], () => 0, ids.map(stack), undefined,
  undefined, undefined, undefined, () => erudition)
const effective = inventory => applyCarriedBonuses(base, inventory.getBonusItems(), definitions)
const read = (inventory, id) => inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === id))

test('reading consumes one indexed copy, grants a permanent bonus and rejects duplicate reading', () => {
  const id = 'sport-magazine-athletics'
  const inventory = setup([id, id])
  assert.deepEqual(effective(inventory), base)
  assert.deepEqual(activeBonusItems(inventory.getSnapshot().items, {}, definitions), [])
  inventory.openInventory()
  read(inventory, id)
  assert.deepEqual(inventory.getSnapshot().items, [stack(id)])
  assert.equal(effective(inventory).skills.athletics, base.skills.athletics + 1)
  const after = inventory.getSnapshot()
  read(inventory, id)
  assert.equal(inventory.getSnapshot(), after)
  inventory.removeItems([stack(id)])
  assert.equal(effective(inventory).skills.athletics, base.skills.athletics + 1)
  const restored = setup([])
  restored.restoreState(inventory.saveState())
  restored.grantItems([stack(id)])
  read(restored, id)
  assert.deepEqual(restored.getSnapshot().items, [stack(id)])
  assert.deepEqual(restored.getSnapshot().readBooks, [id])
  assert.deepEqual(effective(restored), effective(inventory))
  assert.equal(restored.consumeItem(id), false)
  const action = setup(['romance-book'])
  assert.equal(action.consumeItem('romance-book'), true)
  assert.deepEqual(action.getSnapshot().readBooks, ['romance-book'])
})

test('unmet knowledge, invalid slots and container menus cannot consume books or learn bonuses', () => {
  const id = 'chemistry-medicine', inventory = setup([id], 1)
  read(inventory, id)
  inventory.useItem(-1); inventory.useItem(99); inventory.useItem(0.5)
  assert.deepEqual(inventory.getSnapshot().readBooks, [])
  assert.deepEqual(inventory.getSnapshot().items, [stack(id)])
  const trading = new InventoryService(data.items, [{ id: 'shop', name: 'Shop', locationId: 'test', vendor: true, items: [] }],
    () => 0, [stack(id)], undefined, undefined, undefined, undefined, () => 20)
  trading.openContainer('shop')
  read(trading, id)
  assert.deepEqual(trading.getSnapshot().readBooks, [])
  assert.deepEqual(trading.getSnapshot().items, [stack(id)])
})

test('each issue, tome and genre book grants exactly its authored skills, independent of other copies', () => {
  const books = data.items.filter(item => item.readable)
  assert.equal(books.length, 26)
  const expected = {
    'sport-magazine': ['athletics', 'martialArts', 'stealth'], 'health-magazine': ['medicine', 'erudition'],
    'technical-magazine': ['weapons', 'scraper', 'lockpicking'], newspaper: ['persuasion', 'barter', 'intimidation'],
    chemistry: ['erudition', 'medicine'], mechanics: ['lockpicking', 'weapons', 'scraper'],
    psychology: ['persuasion', 'barter', 'intimidation'], anatomy: ['stealth', 'athletics', 'martialArts'],
  }
  for (const [group, skills] of Object.entries(expected)) for (const skill of skills) {
    const book = definitions[`${group}-${skill}`]
    assert.deepEqual(book.bonus, { skill, amount: group.includes('magazine') || group === 'newspaper' ? 1 : 2 })
  }
  for (const [genre, skills] of Object.entries({ detective: ['intimidation', 'weapons', 'lockpicking'], romance: ['persuasion', 'stealth'],
    'sci-fi': ['erudition', 'scraper', 'medicine'], fantasy: ['athletics', 'martialArts', 'barter'] })) {
    const bonuses = definitions[`${genre}-book`].bonuses
    assert.deepEqual(bonuses.map(bonus => bonus.skill), skills)
    assert.equal(bonuses.reduce((sum, bonus) => sum + bonus.amount, 0), 4)
  }
  for (const book of books) {
    const inventory = setup([book.id])
    read(inventory, book.id)
    const learned = effective(inventory)
    for (const skill of Object.keys(base.skills)) {
      const amount = itemBonuses(book).filter(bonus => bonus.skill === skill).reduce((sum, bonus) => sum + bonus.amount, 0)
      assert.equal(learned.skills[skill], base.skills[skill] + amount, `${book.id}: ${skill}`)
    }
    assert.deepEqual(applyCarriedBonuses(base, [stack(book.id)], definitions), base)
    assert.deepEqual(applyCarriedBonuses(base, inventory.getBonusItems(), definitions, 1, 1, 1.5), learned)
  }
  const inventory = setup(['health-magazine-medicine', 'chemistry-medicine', 'sci-fi-book'])
  for (const id of ['health-magazine-medicine', 'chemistry-medicine', 'sci-fi-book']) read(inventory, id)
  assert.equal(effective(inventory).skills.medicine, base.skills.medicine + 4)
})

test('legacy copies, tool slots, deposits and moved developer safe migrate without granting reading', () => {
  const before = setup([]).saveState()
  before.items = [stack('medicine-training-magazine')]
  before.equipment = { tool: 'stealth-training-magazine' }
  const oldSafe = 'living-district:apartments:apartment-51:developer-container'
  const newSafe = 'living-district:apartments:apartment-21:developer-container'
  before.containers = { [oldSafe]: { items: [stack('encyclopedia'), stack('leather-journal')], locked: false } }
  before.deposits = { [oldSafe]: [stack('encyclopedia'), stack('leather-journal')] }
  const migrated = migrateReadingInventory(before)
  assert.equal(migrated.containers[oldSafe], undefined)
  assert.deepEqual(migrated.containers[newSafe].items, [stack('chemistry-erudition'), stack('chemistry-erudition')])
  assert.deepEqual(migrated.deposits[newSafe], [{ itemId: 'chemistry-erudition', quantity: 2 }])
  assert.deepEqual(migrated.readBooks, [])
  const restored = setup([])
  restored.restoreState(before)
  assert.deepEqual(restored.getSnapshot().items, [stack('health-magazine-medicine'), stack('sport-magazine-stealth')])
  assert.deepEqual(effective(restored), base)
  const placement = roomContainerPlacements(data.locations, data.buildings, data.rooms).find(piece => piece.developerStock)
  assert.equal(placement.id, newSafe)
  assert.equal(placement.type, 'safe')
  assert.equal(placement.locked, false)
})

test('reading migration preserves malformed duplicate records for the save validator to reject', () => {
  const saved = setup([]).saveState()
  const duplicate = [stack('chemistry-erudition'), stack('chemistry-erudition')]
  saved.deposits = { box: duplicate }
  saved.legendaryBarterStock = { visible: false, items: duplicate }
  const migrated = migrateReadingInventory(saved)
  assert.deepEqual(migrated.deposits.box, duplicate)
  assert.deepEqual(migrated.legendaryBarterStock.items, duplicate)
})
