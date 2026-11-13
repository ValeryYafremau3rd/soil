import assert from 'node:assert/strict'
import test from 'node:test'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { content } from '../helpers/content.mjs'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses } from '../../src/domain/inventory/items.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'

test('a six-slot medical learning path unlocks specialist treatment and removing training blocks repeated use', () => {
  const data = content(), definition = classes[0], base = createCharacter(definition)
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  const status = new StatusService([{ id: 'health', value: 40, max: 100 },
    { id: 'energy', value: 100, max: 100 }, { id: 'sanity', value: 100, max: 100 }])
  let inventory
  const effective = () => applyCarriedBonuses(base, inventory?.getSnapshot().items ?? [], definitions)
  const initial = definition.startingItems.map(itemId => ({ itemId, quantity: definition.startingItemQuantities?.[itemId] ?? 1 }))
  inventory = new InventoryService(data.items, [], () => 0, initial, status, undefined, undefined,
    () => {}, () => effective().skills.erudition, false, undefined, undefined, () => effective().skills)
  assert.equal(inventory.removeItems([{ itemId: 'canned-meat', quantity: 2 }, { itemId: 'stealth-training-magazine', quantity: 1 }, { itemId: 'crowbar', quantity: 1 }]), true)
  inventory.grantItems([{ itemId: 'medical-case', quantity: 2 }, { itemId: 'medicine-training-handbook', quantity: 1 }])
  assert.equal(effective().skills.medicine, 8, 'advanced book bonus applies immediately while carried')
  inventory.openInventory()
  const useCase = () => inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === 'medical-case'))
  useCase(); useCase()
  assert.equal(status.getSnapshot().health, 40)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'medical-case').quantity, 2)
  inventory.grantItems([{ itemId: 'medicine-training-magazine', quantity: 1 }, { itemId: 'agriculture-guide', quantity: 1 }])
  assert.equal(inventory.getSnapshot().items.length, 6)
  assert.equal(effective().skills.medicine, 12)
  assert.equal(effective().skills.erudition, 4, 'practical skill route works below the education gate')
  useCase()
  assert.equal(status.getSnapshot().health, 100)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'medical-case').quantity, 1)
  assert.equal(inventory.removeItems([{ itemId: 'medicine-training-magazine', quantity: 1 },
    { itemId: 'medicine-training-handbook', quantity: 1 }]), true)
  assert.equal(effective().skills.medicine, 6)
  status.takeDamage(10)
  useCase()
  assert.equal(status.getSnapshot().health, 90)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'medical-case').quantity, 1)
})
