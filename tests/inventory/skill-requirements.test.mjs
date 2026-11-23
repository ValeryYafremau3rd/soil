import test from 'node:test'
import assert from 'node:assert/strict'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { applyCarriedBonuses, unmetItemRequirements } from '../../src/domain/inventory/items.ts'
import { conditionedCharacter } from '../../src/domain/skills/condition.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

const stack = (itemId, quantity = 1) => ({ itemId, quantity })
const hero = createCharacter({ id: 'test', name: 'Test', attributes: { strength: 1, agility: 2, intelligence: 2, willpower: 2, charisma: 1 }, startingItems: [] })

test('carried permanent bonuses ignore skill requirements, self requirements and dependency cycles', () => {
  const definitions = {
    locked: { id: 'locked', skillRequirements: { scraper: 6 }, bonus: { skill: 'scraper', amount: 5 } },
    primer: { id: 'primer', skillRequirements: { scraper: 5 }, bonus: { skill: 'scraper', amount: 1 } },
    cycleA: { id: 'cycleA', skillRequirements: { medicine: 7 }, bonus: { skill: 'scraper', amount: 1 } },
    cycleB: { id: 'cycleB', skillRequirements: { scraper: 6 }, bonus: { skill: 'medicine', amount: 1 } },
  }
  assert.equal(applyCarriedBonuses(hero, [stack('locked')], definitions).skills.scraper, hero.skills.scraper + 5)
  const combined = applyCarriedBonuses(hero, [stack('cycleA'), stack('cycleB')], definitions)
  assert.equal(combined.skills.scraper, hero.skills.scraper + 1)
  assert.equal(combined.skills.medicine, hero.skills.medicine + 1)
  for (const items of [[stack('locked'), stack('primer')], [stack('primer'), stack('locked')]]) {
    const equipped = applyCarriedBonuses(hero, items, definitions)
    assert.equal(equipped.skills.scraper, 11)
    assert.deepEqual(applyCarriedBonuses(equipped, [], definitions), hero)
  }
  const tired = conditionedCharacter(hero, [stack('locked'), stack('primer')], definitions,
    { energy: 40, sanity: 100 }, { energy: 100, sanity: 100 })
  assert.equal(tired.attributes.strength, 0)
  assert.equal(tired.skills.scraper, 10, 'Energy lowers derived skills but does not disable already eligible carried bonuses')
})

test('all requirements are necessary; failed consumptions and tool checks spend nothing and explain the missing skill', () => {
  let skills = { erudition: 8, medicine: 5, scraper: 2 }
  const messages = [], status = new StatusService(['health', 'energy', 'sanity'].map(id => ({ id, value: 40, max: 100 })))
  const definitions = [{ id: 'med', eruditionRequired: 8, skillRequirements: { medicine: 6, scraper: 3 }, consumable: true, recovery: { health: 10 } }]
  const inventory = new InventoryService(definitions, [], () => 0, [stack('med')], status, undefined, undefined,
    text => messages.push(text), () => skills.erudition, false, undefined, undefined, () => skills)
  inventory.openInventory()
  const before = inventory.getSnapshot()
  inventory.useItem(0)
  assert.equal(inventory.consumeItem('med'), false)
  assert.equal(inventory.canUseItem('med'), false)
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(status.getSnapshot().health, 40)
  assert.match(messages[0], /Requires Medicine 6.*Medicine is 5.*Requires Scraper 3/)
  skills = { ...skills, medicine: 6, scraper: 3, erudition: 7 }
  assert.equal(inventory.canUseItem('med'), false)
  assert.match(messages.at(-1), /Requires Erudition 8/)
  skills.erudition = 8
  inventory.useItem(0)
  assert.equal(status.getSnapshot().health, 50)
  assert.deepEqual(inventory.getSnapshot().items, [])
})

test('shooting skips unusable guns and rechecks weapon and ammunition skills before spending a round', () => {
  let weapons = 4
  const definitions = [
    { id: 'heavy', firearm: { ammunitionId: 'heavy-round' }, skillRequirements: { weapons: 10 } },
    { id: 'light', firearm: { ammunitionId: 'light-round' }, skillRequirements: { weapons: 4 } },
    { id: 'heavy-round', ammunition: true, consumable: true },
    { id: 'light-round', ammunition: true, consumable: true, skillRequirements: { weapons: 3 }, maxStack: 5 },
  ]
  const inventory = new InventoryService(definitions, [], () => 0,
    [stack('heavy'), stack('light'), stack('heavy-round'), stack('light-round', 2)], undefined, undefined, undefined,
    undefined, () => 20, false, undefined, undefined, () => ({ weapons }))
  assert.equal(inventory.canShoot(), true)
  weapons = 3
  const before = inventory.getSnapshot()
  assert.equal(inventory.tryShoot(), false)
  assert.equal(inventory.getSnapshot(), before)
  weapons = 4
  assert.equal(inventory.tryShoot(), true)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'heavy-round').quantity, 1)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'light-round').quantity, 1)
  definitions[3].skillRequirements.weapons = 5
  assert.equal(inventory.tryShoot(), false, 'ammo requirements are separate from gun requirements')
})

test('basics are universally accessible, class equipment fits unmodified skills, and specialist items demand relevant training', () => {
  const { items } = content()
  for (const item of items.filter(item => ['Food', 'Drink', 'Scrap', 'Quest'].includes(item.category) || item.inventorySlots || item.keys)) {
    assert.equal(item.eruditionRequired, 2, item.id)
    assert.equal(item.skillRequirements, undefined, item.id)
  }
  assert.deepEqual(items.find(item => item.id === 'lockpick').skillRequirements, { lockpicking: 3 })
  assert.deepEqual(items.find(item => item.id === 'first-aid-kit').skillRequirements, { medicine: 10 })
  assert.deepEqual(unmetItemRequirements({ id: 'test', eruditionRequired: 6, skillRequirements: { lockpicking: 8 } },
    { erudition: 6, lockpicking: 8 }), [])
})

test('skill requirement schema rejects unknown skills, duplicate Erudition, invalid levels and malformed data', () => {
  for (const requirements of [{ typo: 3 }, { erudition: 3 }, { weapons: 0 }, { weapons: -1 }, { weapons: 1.5 }, { weapons: 31 }, { medicine: '5' }, []]) {
    const data = content()
    data.items.find(item => item.id === 'crowbar').skillRequirements = requirements
    assert.throws(() => validateContent(data), /skillRequirements/)
  }
})
