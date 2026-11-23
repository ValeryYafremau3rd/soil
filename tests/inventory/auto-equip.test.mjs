import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'

const stack = (itemId, quantity = 1) => ({ itemId, quantity })
const definitions = [
  { id: 'hammer', equipmentSlot: 'tool' },
  { id: 'wrench', equipmentSlot: 'tool' },
  { id: 'bag', equipmentSlot: 'bag', inventorySlots: 3 },
  { id: 'coat', equipmentSlot: 'armor', eruditionRequired: 8 },
  { id: 'money', maxStack: 100 },
  ...Array.from({ length: 9 }, (_, index) => ({ id: `supply${index}` })),
]
const supplies = count => Array.from({ length: count }, (_, index) => stack(`supply${index}`))

test('rewards equip one copy, preserve occupied slots and leave manually unequipped gear alone', () => {
  const inventory = new InventoryService(definitions, [])
  inventory.grantItems([stack('hammer', 2), stack('wrench')])
  assert.deepEqual(inventory.getSnapshot().equipment, { tool: 'hammer' })
  assert.deepEqual(inventory.getSnapshot().items, [stack('hammer'), stack('wrench')])
  inventory.unequip('tool')
  inventory.grantItems([stack('supply0')])
  assert.deepEqual(inventory.getSnapshot().equipment, {})
  const saved = inventory.saveState()
  inventory.restoreState(saved)
  assert.deepEqual(inventory.getSnapshot().equipment, {})
})

test('unmet requirements keep received items in inventory without notifications', () => {
  const messages = []
  const inventory = new InventoryService(definitions, [], () => 0, [], undefined, undefined, undefined, message => messages.push(message))
  inventory.grantItems([stack('coat')])
  assert.deepEqual(inventory.getSnapshot().equipment, {})
  assert.deepEqual(inventory.getSnapshot().items, [stack('coat')])
  assert.deepEqual(messages, [])
})

test('full inventory accepts empty-slot equipment and bags expand capacity atomically', () => {
  const inventory = new InventoryService(definitions, [], () => 0, supplies(6))
  inventory.grantItems([stack('hammer')])
  assert.equal(inventory.getSnapshot().equipment.tool, 'hammer')
  inventory.grantItems([...supplies(9).slice(6), stack('bag')])
  assert.equal(inventory.getCapacity(), 9)
  assert.equal(inventory.getSnapshot().items.length, 9)
  const before = inventory.getSnapshot()
  assert.equal(inventory.tryExchangeItems([], [stack('wrench')]), false)
  assert.equal(inventory.getSnapshot(), before)
})

test('loot and take all equip gear and count equipped items as pickups', () => {
  const inventory = new InventoryService(definitions, [{ id: 'crate', name: 'Crate', locationId: 'test', items: [stack('hammer'), stack('bag'), stack('supply6')] }], () => 0, supplies(6))
  const pickups = []
  inventory.subscribeLoot(pickup => pickups.push(pickup))
  inventory.openContainer('crate')
  inventory.takeAll()
  assert.deepEqual(inventory.getSnapshot().equipment, { tool: 'hammer', bag: 'bag' })
  assert.equal(inventory.getSnapshot().containers.crate.items.length, 0)
  assert.deepEqual(pickups[0].items, [stack('hammer'), stack('bag'), stack('supply6')])
})

test('purchases auto-equip only after payment succeeds and buy one copy', () => {
  const inventory = new InventoryService(definitions.map(item => ({ ...item, price: 3 })), [{ id: 'vendor', name: 'Vendor', locationId: 'test', vendor: true, items: [stack('hammer', 2)] }], () => 0, [stack('money', 2)])
  inventory.openContainer('vendor')
  const before = inventory.getSnapshot()
  inventory.takeItem('hammer')
  assert.equal(inventory.getSnapshot(), before)
  inventory.grantItems([stack('money')])
  inventory.takeItem('hammer')
  assert.equal(inventory.getSnapshot().equipment.tool, 'hammer')
  assert.equal(inventory.getSnapshot().money, 0)
})

test('container swaps equip one incoming copy and keep the exchange intact', () => {
  const inventory = new InventoryService(definitions, [{ id: 'crate', name: 'Crate', locationId: 'test', items: [stack('hammer', 2)] }], () => 0, [stack('supply0')])
  inventory.openContainer('crate')
  inventory.swapItems('supply0', 'hammer')
  assert.deepEqual(inventory.getSnapshot().equipment, { tool: 'hammer' })
  assert.deepEqual(inventory.getSnapshot().items, [])
  assert.deepEqual(inventory.getSnapshot().containers.crate.items, [stack('hammer'), stack('supply0')])
})
