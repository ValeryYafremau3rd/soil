import assert from 'node:assert/strict'
import test from 'node:test'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { content } from '../helpers/content.mjs'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses } from '../../src/domain/inventory/items.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'

test('reading unlocks specialist medicine permanently, including after duplicate books are removed', () => {
  const data = content(), base = createCharacter(classes[0])
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  const required = definitions['medical-case'].skillRequirements.medicine
  base.skillModifiers = { medicine: required - 3 - base.skills.medicine }
  const status = new StatusService([{ id: 'health', value: 40, max: 100 },
    { id: 'energy', value: 100, max: 100 }, { id: 'sanity', value: 100, max: 100 }])
  let inventory
  const effective = () => applyCarriedBonuses(base, inventory?.getBonusItems() ?? [], definitions)
  inventory = new InventoryService(data.items, [], () => 0,
    [{ itemId: 'medical-case', quantity: 2 }, { itemId: 'health-magazine-medicine', quantity: 1 }, { itemId: 'chemistry-medicine', quantity: 1 }],
    status, undefined, undefined, undefined, () => 10, false, undefined, undefined, () => effective().skills)
  inventory.openInventory()
  const use = id => inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === id))
  use('medical-case')
  assert.equal(status.getSnapshot().health, 40)
  use('health-magazine-medicine')
  use('medical-case')
  assert.equal(status.getSnapshot().health, 40)
  use('chemistry-medicine')
  assert.equal(effective().skills.medicine, required)
  use('medical-case')
  assert.equal(status.getSnapshot().health, Math.min(100, 40 + definitions['medical-case'].recovery.health))
  inventory.grantItems([{ itemId: 'chemistry-medicine', quantity: 1 }])
  inventory.removeItems([{ itemId: 'chemistry-medicine', quantity: 1 }])
  status.takeDamage(10)
  use('medical-case')
  assert.equal(status.getSnapshot().health, 100)
  assert.ok(!inventory.getSnapshot().items.some(item => item.itemId === 'medical-case'))
})
