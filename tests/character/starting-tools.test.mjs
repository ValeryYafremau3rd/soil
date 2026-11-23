import assert from 'node:assert/strict'
import test from 'node:test'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { unmetItemRequirements } from '../../src/domain/inventory/items.ts'

test('new heroes receive usable class utility items without losing supplies or money', () => {
  const items = content().items
  const tools = { loader: 'rope', safecracker: 'pliers', professor: 'briefcase' }
  for (const definition of classes) {
    const character = createCharacter(definition)
    const inventory = new InventoryService(items, [], () => 0, [], undefined, undefined, undefined, undefined,
      () => character.skills.erudition, false, undefined, undefined, () => character.skills)
    const kit = definition.startingItems.map(itemId => ({
      itemId, quantity: definition.startingItemQuantities?.[itemId] ?? 1,
    }))
    inventory.grantItems(kit)
    const snapshot = inventory.getSnapshot()
    const received = [...snapshot.items, ...inventory.getEquippedItems()]
    assert.deepEqual(received.toSorted((a, b) => a.itemId.localeCompare(b.itemId)), kit.toSorted((a, b) => a.itemId.localeCompare(b.itemId)))
    assert.ok(snapshot.items.length <= 6)
    assert.equal(snapshot.money, definition.startingItemQuantities.money)
    const tool = items.find(item => item.id === tools[definition.id])
    assert.equal(snapshot.equipment[tool.equipmentSlot], tool.id)
    assert.deepEqual(unmetItemRequirements(tool, createCharacter(definition).skills), [])
  }
})
