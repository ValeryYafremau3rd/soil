import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue, content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { itemBonuses, unmetItemRequirements } from '../../src/domain/inventory/items.ts'

test('specialist tiers cap at ten while advanced education stays reachable at twenty', () => {
  const items = Object.fromEntries(content().items.map(item => [item.id, item]))
  assert.equal(items.bread.eruditionRequired, 2)
  assert.equal(items.encyclopedia.eruditionRequired, 4)
  assert.equal(items.crowbar.eruditionRequired, 8)
  assert.deepEqual(items.crowbar.skillRequirements, { martialArts: 5 })
  assert.equal(items['service-pistol'].eruditionRequired, 12)
  assert.deepEqual(items['service-pistol'].skillRequirements, { weapons: 10 })
  assert.equal(items['medical-case'].eruditionRequired, 18)
  assert.deepEqual(items['medical-case'].skillRequirements, { medicine: 10 })
  assert.deepEqual(items['machine-blueprints'].skillRequirements, { scraper: 10 })
  assert.deepEqual(items['machine-blueprints'].bonus, { skill: 'scraper', amount: 5 })
  assert.equal(items['triquetra-pendant'].eruditionRequired, 20)
  assert.deepEqual(unmetItemRequirements(items['triquetra-pendant'], { erudition: 20 }), [])
  assert.deepEqual(items.crowbar.bonus, { skill: 'martialArts', amount: 2 })
  assert.deepEqual(items.encyclopedia.bonus, { skill: 'erudition', amount: 3 })
})

test('every authored item requires education, with basic goods and specialist equipment in appropriate tiers', () => {
  const { items } = content()
  for (const item of items) {
    assert.ok(Number.isInteger(item.eruditionRequired) && item.eruditionRequired >= 1 && item.eruditionRequired <= 20, item.id)
    for (const required of Object.values(item.skillRequirements ?? {})) {
      assert.ok(Number.isInteger(required) && required >= 1 && required <= 10, item.id)
    }
    if (['Food', 'Drink', 'Material', 'Currency', 'Quest', 'Scrap', 'Supply'].includes(item.category) || item.keys) {
      assert.equal(item.eruditionRequired, 2, item.id)
      assert.equal(item.skillRequirements, undefined, item.id)
    }
    if (['bandage', 'balm-tin'].includes(item.id)) {
      assert.deepEqual(unmetItemRequirements(item, { erudition: 2, medicine: 1 }), [])
    } else if (item.category === 'Medical') {
      assert.ok(item.skillRequirements.medicine >= 2)
      assert.ok(item.eruditionRequired > item.skillRequirements.medicine)
      assert.deepEqual(unmetItemRequirements(item, { erudition: 1, medicine: item.skillRequirements.medicine }), [])
    }
    if (item.category === 'Weapon') assert.ok(item.eruditionRequired >= 3, item.id)
    if (item.firearm) assert.ok(item.eruditionRequired >= 6, item.id)
    for (const bonus of itemBonuses(item)) assert.ok(bonus.amount <= (bonus.attribute ? 3 : 10), item.id)
  }
  for (const id of ['loader', 'safecracker', 'professor']) {
    const definition = classes.find(entry => entry.id === id)
    const character = createCharacter(definition)
    for (const itemId of definition.startingItems) {
      assert.deepEqual(unmetItemRequirements(items.find(item => item.id === itemId), character.skills), [], `${id}: ${itemId}`)
    }
  }
  const classGear = { loader: ['crowbar', 'hatchet', 'rope'], safecracker: ['lockpick', 'pliers', 'precision-screwdriver'],
    professor: ['postcard', 'letter', 'certificate'] }
  for (const [classId, itemIds] of Object.entries(classGear)) {
    const hero = createCharacter(classes.find(entry => entry.id === classId))
    for (const itemId of itemIds) assert.deepEqual(unmetItemRequirements(items.find(item => item.id === itemId), hero.skills), [], `${classId}: ${itemId}`)
  }
  const grifter = createCharacter(classes[2])
  assert.ok(unmetItemRequirements(items.find(item => item.id === 'medical-case'), grifter.skills).length)
  assert.ok(unmetItemRequirements(items.find(item => item.id === 'service-pistol'), grifter.skills).length)
})

test('authored items cannot omit their education requirement', () => {
  const { data, sources } = catalogue()
  delete data.items.find(item => item.id === 'hammer').eruditionRequired
  assert.throws(() => validateContent(data, sources), /hammer.*eruditionRequired/)
})

test('content rejects specialist requirements above ten', () => {
  const { data, sources } = catalogue()
  data.items.find(item => item.id === 'hammer').skillRequirements = { scraper: 11 }
  assert.throws(() => validateContent(data, sources), /skillRequirements.scraper/)
})
