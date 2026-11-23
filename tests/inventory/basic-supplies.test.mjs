import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { SKILL_LABELS } from '../../src/domain/skills/character.ts'
import { itemRequirementStates } from '../../src/domain/inventory/items.ts'
import { content } from '../helpers/content.mjs'

test('food, drinks and basic first aid restore vitals repeatedly with zero skills', () => {
  const { items } = content()
  const skills = Object.fromEntries(Object.keys(SKILL_LABELS).map(skill => [skill, 0]))
  const supplies = items.filter(item => ['Food', 'Drink'].includes(item.category) || ['bandage', 'balm-tin'].includes(item.id))
  assert.ok(supplies.length > 0)
  for (const item of supplies) {
    assert.deepEqual(itemRequirementStates(item, skills), [], item.id)
    const status = new StatusService()
    status.restoreState({ health: 1, energy: 1, sanity: 1 })
    const inventory = new InventoryService(items, [], () => 0, [{ itemId: item.id, quantity: 2 }], status,
      undefined, undefined, undefined, () => 0, false, undefined, undefined, () => skills)
    inventory.openInventory()
    for (let use = 0; use < 2; use++) {
      const before = status.getSnapshot()
      inventory.useItem(0)
      for (const [vital, amount] of Object.entries(item.recovery)) {
        assert.equal(status.getSnapshot()[vital], Math.min(status.getLimits()[vital], before[vital] + amount), `${item.id}: ${vital}`)
      }
    }
    assert.deepEqual(inventory.getSnapshot().items, [], item.id)
  }
})

test('ordinary supplies, materials, currency and keys have no requirements', () => {
  for (const item of content().items) {
    if (item.equipmentSlot || !(['Supply', 'Material', 'Scrap', 'Currency', 'Quest'].includes(item.category) || item.keys)) continue
    assert.equal(item.eruditionRequired, undefined, item.id)
    assert.equal(item.skillRequirements, undefined, item.id)
    assert.equal(item.requirementMode, undefined, item.id)
  }
})
