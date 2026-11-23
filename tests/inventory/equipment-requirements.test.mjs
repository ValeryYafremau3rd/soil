import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { SKILL_LABELS } from '../../src/domain/skills/character.ts'
import { content } from '../helpers/content.mjs'

test('every practical skill unlocks equipment and repeated failed equips preserve inventory', () => {
  const items = content().items
  for (const skill of Object.keys(SKILL_LABELS).filter(skill => skill !== 'erudition')) {
    const equipment = items.filter(item => item.equipmentSlot && item.skillRequirements?.[skill])
    assert.ok(equipment.length >= 2, `${skill} needs equipment choices`)
    for (const item of equipment) {
      const required = item.skillRequirements[skill]
      let skills = Object.fromEntries(Object.keys(SKILL_LABELS).map(key => [key, key === 'erudition' ? 0 : 30]))
      skills[skill] = required - 1
      const inventory = new InventoryService(items, [], () => 0, [{ itemId: item.id, quantity: 1 }],
        undefined, undefined, undefined, undefined, () => 0, false, undefined, undefined, () => skills)
      inventory.openInventory()
      const before = inventory.getSnapshot()
      inventory.useItem(0)
      inventory.useItem(0)
      assert.equal(inventory.getSnapshot(), before, `${item.id}: unmet ${skill}`)
      skills = { ...skills, [skill]: required }
      inventory.useItem(0)
      assert.equal(inventory.getSnapshot().equipment[item.equipmentSlot], item.id, item.id)
      assert.deepEqual(inventory.getSnapshot().items, [], item.id)
    }
  }
})
