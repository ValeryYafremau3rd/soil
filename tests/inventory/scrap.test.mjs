import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { scrapChance, scrapReward } from '../../src/domain/inventory/scrap.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { applyCarriedBonuses } from '../../src/domain/inventory/items.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

const data = content()
const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
const stack = (itemId, quantity = 1) => ({ itemId, quantity })
function setup(items, rolls, skill = 10) {
  const messages = []
  const inventory = new InventoryService(data.items, [{ id: 'crate', name: 'Crate', locationId: 'test' }],
    () => rolls.shift() ?? 0, items, undefined, undefined, undefined, text => messages.push(text), () => 20, false, undefined, () => skill)
  inventory.openInventory()
  return { inventory, messages }
}

test('Scraper increases a small capped chance; rarity-weighted rewards include tools, ammunition and a rare gun', () => {
  assert.equal(scrapChance(0), 0.04)
  assert.ok(Math.abs(scrapChance(10) - 0.24) < 1e-12)
  assert.equal(scrapChance(1000), 0.5)
  assert.equal(scrapChance(-100), scrapChance(0))
  for (const skill of [0, 1, 5, 10, 14]) {
    assert.ok(Math.abs(scrapChance(skill) - 2 * Math.min(0.45, 0.02 + skill * 0.01)) < 1e-12)
  }
  assert.equal(scrapReward(10, definitions, () => scrapChance(10)), null)
  const improvedRolls = [0.2, 0, 0]
  assert.ok(scrapReward(10, definitions, () => improvedRolls.shift()))
  assert.equal(scrapReward(10, definitions, () => 0.99), null)
  const rolls = [0, 0, 0.999999]
  const gun = scrapReward(10, definitions, () => rolls.shift())
  assert.equal(gun.itemId, 'service-pistol')
  assert.equal(definitions[gun.itemId].rarity, 'legendary')
  assert.ok(data.skills.scrapping.rewards.some(item => definitions[item.itemId].ammunition))
  assert.ok(data.skills.scrapping.rewards.some(item => item.itemId === 'screwdriver'))
})

test('scrapping spends one selected slot, gives one result on success, and failure still consumes scrap', () => {
  const { inventory, messages } = setup([stack('bent-nails'), stack('bent-nails'), stack('bent-nails')], [0, 0, 0, 0.99])
  const first = inventory.getSnapshot().items[0], third = inventory.getSnapshot().items[2]
  inventory.useItem(1)
  assert.deepEqual(inventory.getSnapshot().items, [stack('bent-nails'), stack('bent-nails'), stack('pistol-ammunition')])
  assert.equal(inventory.getSnapshot().items[0], first)
  assert.equal(inventory.getSnapshot().items[1], third)
  assert.match(messages.at(-1), /succeeded/)
  inventory.useItem(1)
  assert.deepEqual(inventory.getSnapshot().items, [stack('bent-nails'), stack('pistol-ammunition')])
  assert.match(messages.at(-1), /Nothing usable/)
})

test('scrapping frees its slot before creating ammo or a gun even when the bag is full', () => {
  const fillers = ['rope', 'wrench', 'pliers', 'cloth', 'work-pass'].map(id => stack(id))
  const freed = setup([stack('bent-nails'), ...fillers], [0, 0, 0]).inventory
  freed.useItem(0)
  assert.equal(freed.getSnapshot().items.length, 6)
  assert.ok(freed.getSnapshot().items.some(item => item.itemId === 'pistol-ammunition'))
  assert.ok(!freed.getSnapshot().items.some(item => item.itemId === 'bent-nails'))
  const gun = setup([stack('bent-nails'), ...fillers], [0, 0, 0.999999]).inventory
  gun.useItem(0)
  assert.equal(gun.getSnapshot().items.length, 6)
  assert.ok(gun.getSnapshot().items.some(item => item.itemId === 'service-pistol'))
  const partial = setup([stack('bent-nails'), stack('pistol-ammunition', 4), ...fillers.slice(0, 4)], [0, 0, 0]).inventory
  partial.useItem(0)
  assert.equal(partial.getSnapshot().items.find(item => item.itemId === 'pistol-ammunition').quantity, 5)
  assert.equal(partial.getSnapshot().items.length, 5)
})

test('scrapping is blocked in container menus and stronger gear can improve its chance', () => {
  const { inventory } = setup([stack('bent-nails')], [])
  inventory.openContainer('crate')
  const before = inventory.getSnapshot()
  inventory.useItem(0)
  assert.equal(inventory.getSnapshot(), before)
  const hero = createCharacter({ id: 'test', name: 'Test', attributes: { strength: 2, agility: 2, intelligence: 4, willpower: 2, charisma: 2 }, startingItems: [] })
  const gear = applyCarriedBonuses(hero, [stack('work-gloves')], definitions)
  assert.equal(gear.skills.scraper, hero.skills.scraper + 2, 'authored +2 Scraper contributes exactly +2')
  assert.ok(scrapChance(gear.skills.scraper) > scrapChance(hero.skills.scraper))
})

test('quick-slot scrapping works with no menu and spends only the selected scrap on success or failure', () => {
  for (const rolls of [[0, 0, 0], [0.99]]) {
    const { inventory } = setup([stack('bent-nails'), stack('bent-nails'), stack('bent-nails')], rolls)
    inventory.closeMenu()
    const first = inventory.getSnapshot().items[0], third = inventory.getSnapshot().items[2]
    inventory.useItem(1)
    const items = inventory.getSnapshot().items
    assert.equal(items.filter(item => item.itemId === 'bent-nails').length, 2)
    assert.equal(items[0], first)
    assert.equal(items[1], third)
    assert.equal(inventory.getSnapshot().menu, null)
    const after = inventory.getSnapshot()
    for (const slot of [-1, 99, 0.5]) inventory.useItem(slot)
    assert.equal(inventory.getSnapshot(), after)
  }
})

test('quick-slot scrapping retains item requirements and can reuse the consumed slot in a full inventory', () => {
  const unknown = new InventoryService(data.items, [], () => 0, [stack('bent-nails')],
    undefined, undefined, undefined, undefined, () => 0)
  const before = unknown.getSnapshot()
  unknown.useItem(0)
  assert.equal(unknown.getSnapshot(), before)
  const { inventory } = setup([stack('bent-nails'), ...['rope', 'wrench', 'pliers', 'cloth', 'work-pass'].map(id => stack(id))], [0, 0, 0])
  inventory.closeMenu()
  inventory.useItem(0)
  assert.equal(inventory.getSnapshot().items.length, 6)
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'pistol-ammunition'))
})

test('all items have rarity, scrap cannot carry other powers, and scrap rewards reference useful items', () => {
  for (const item of data.items) assert.ok(['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(item.rarity), item.id)
  assert.ok(data.items.filter(item => item.scrap).length >= 10)
  for (const item of data.items.filter(item => item.scrap)) assert.equal(item.maxStack, 1, item.id)
  for (const patch of [
    data => { data.items.find(item => item.scrap).bonus = { skill: 'scraper', amount: 2 } },
    data => { data.items.find(item => item.scrap).maxStack = 2 },
    data => { data.skills.scrapping.rewards[0].itemId = 'missing' },
    data => { data.skills.scrapping.rewards[0].itemId = 'bent-nails' },
    data => { data.skills.scrapping.baseChance = 0.91 },
  ]) {
    const { data, sources } = catalogue()
    patch(data)
    assert.throws(() => validateContent(data, sources), /scrap/)
  }
})
