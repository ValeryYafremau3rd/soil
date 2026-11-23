import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { EQUIPMENT_SLOTS } from '../../src/domain/inventory/items.ts'

/** Create minimal equipment definitions for every supported slot. */
function definitions() {
  return EQUIPMENT_SLOTS.flatMap(equipmentSlot => [
    { id: `${equipmentSlot}-old`, equipmentSlot },
    { id: `${equipmentSlot}-new`, equipmentSlot },
  ])
}

test('quick equipment use matches inventory Enter for every equipment slot and swaps', () => {
  for (const slot of EQUIPMENT_SLOTS) {
    const items = ['old', 'new'].map(version => ({ itemId: `${slot}-${version}`, quantity: 1 }))
    const quick = new InventoryService(definitions(), [], () => 0, items)
    const menu = new InventoryService(definitions(), [], () => 0, items)
    menu.openInventory()
    for (let use = 0; use < 2; use++) {
      quick.useItem(0)
      menu.useItem(0)
      assert.deepEqual(quick.getSnapshot().equipment, menu.getSnapshot().equipment, slot)
      assert.deepEqual(quick.getSnapshot().items, menu.getSnapshot().items, slot)
      assert.equal(quick.getSnapshot().menu, null)
    }
    assert.equal(quick.getSnapshot().equipment[slot], `${slot}-new`)
  }
})

test('quick equipment use preserves capacity checks and rejects invalid indices', () => {
  const gear = [
    { id: 'large-bag', equipmentSlot: 'bag', inventorySlots: 3 },
    { id: 'small-bag', equipmentSlot: 'bag', inventorySlots: 1 },
    { id: 'filler', maxStack: 1 },
  ]
  const inventory = new InventoryService(gear, [], () => 0, [
    { itemId: 'large-bag', quantity: 1 }, { itemId: 'small-bag', quantity: 1 },
  ])
  inventory.useItem(0)
  inventory.grantItems([{ itemId: 'filler', quantity: 7 }])
  const before = inventory.getSnapshot()
  for (const index of [0, -1, 0.5, 99]) inventory.useItem(index)
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(inventory.getSnapshot().equipment.bag, 'large-bag')
})

test('quick equipment use rechecks requirements and does not equip from a container menu', () => {
  let education = 0
  const inventory = new InventoryService([
    { id: 'tool', equipmentSlot: 'tool', eruditionRequired: 4 },
  ], [{ id: 'stash', name: 'Stash', locationId: 'test', items: [] }], () => 0,
  [{ itemId: 'tool', quantity: 1 }], undefined, undefined, undefined, undefined,
  () => education)
  const before = inventory.getSnapshot()
  inventory.useItem(0)
  inventory.useItem(0)
  assert.equal(inventory.getSnapshot(), before)
  education = 4
  inventory.openContainer('stash')
  inventory.useItem(0)
  assert.deepEqual(inventory.getSnapshot().equipment, {})
  inventory.closeMenu()
  inventory.useItem(0)
  assert.equal(inventory.getSnapshot().equipment.tool, 'tool')
})
