import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { inventoryCapacity } from '../../src/domain/inventory/loot.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
const stack = (itemId, quantity = 1) => ({ itemId, quantity })
const definitions = [
  { id: 'bag', equipmentSlot: 'bag', inventorySlots: 3, price: 6 },
  { id: 'other-bag', equipmentSlot: 'bag', inventorySlots: 3, price: 6 },
  { id: 'small-bag', equipmentSlot: 'bag', inventorySlots: 1 },
  ...Array.from({ length: 12 }, (_, index) => ({ id: `item${index}`, price: 1 })),
]
const fillers = length => Array.from({ length }, (_, index) => stack(`item${index}`))
function setup(items = [], contents = []) {
  const seeds = [{ id: 'stash', name: 'Stash', locationId: 'test', items: contents },
    { id: 'shop', name: 'Shop', locationId: 'test', vendor: true, items: [stack('bag')] }]
  return new InventoryService(definitions, seeds, () => 0, items)
}
function equip(inventory, id = 'bag') {
  inventory.openInventory()
  inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === id))
}
test('authored bags add three slots only in the equipped bag slot', () => {
  const byId = Object.fromEntries(content().items.map(item => [item.id, item]))
  assert.equal(inventoryCapacity({}, byId), 6)
  for (const id of ['canvas-backpack', 'duffel-bag', 'briefcase']) {
    assert.equal(byId[id].equipmentSlot, 'bag')
    assert.equal(inventoryCapacity({bag:id}, byId), 9)
    const inventory = new InventoryService(content().items, [], () => 0, [stack(id)], undefined, undefined, undefined, undefined, () => 20)
    assert.equal(inventory.getCapacity(), 6)
    equip(inventory,id)
    assert.equal(inventory.getCapacity(), 9)
    assert.deepEqual(inventory.getSnapshot().items, [])
  }
})
test('full inventory auto-equips a bag and expands take-all', () => {
  const inventory = setup(fillers(6), [stack('bag'), stack('item6')])
  inventory.openContainer('stash')
  inventory.takeItem('bag',0);inventory.takeAll()
  assert.equal(inventory.getSnapshot().equipment.bag,'bag')
  assert.equal(inventory.getSnapshot().items.length,7)
  assert.equal(inventory.getCapacity(),9)
  assert.ok(inventory.getSnapshot().items.some(item=>item.itemId==='item6'))
})
test('buying a bag checks payment and auto-equips into an empty slot atomically', () => {
  const inventory=setup([stack('money',20),...fillers(5)])
  inventory.openContainer('shop')
  inventory.takeItem('bag',0)
  assert.equal(inventory.getSnapshot().money,14)
  assert.equal(inventory.getCapacity(),9)
  const poor=setup();poor.openContainer('shop');const unpaid=poor.getSnapshot();poor.takeItem('bag',0)
  assert.equal(poor.getSnapshot(),unpaid)
})
test('multiple carried bags grant no capacity and swapping keeps only one bag bonus', () => {
  const inventory=setup([stack('bag'),stack('bag'),stack('other-bag')])
  assert.equal(inventory.getCapacity(),6)
  equip(inventory);assert.equal(inventory.getCapacity(),9)
  equip(inventory,'other-bag');assert.equal(inventory.getCapacity(),9)
  assert.equal(inventory.getSnapshot().equipment.bag,'other-bag')
  assert.equal(inventory.getSnapshot().items.filter(item=>item.itemId==='bag').length,2)
})
test('unequipping and swapping to smaller bags preserve overflow and succeed once goods fit', () => {
  const inventory=setup([stack('bag'),stack('small-bag')]);equip(inventory)
  inventory.grantItems(fillers(7));const before=inventory.getSnapshot()
  inventory.unequip('bag');inventory.unequip('bag');inventory.useItem(0)
  assert.equal(inventory.getSnapshot(),before)
  inventory.removeItems([stack('item0')]);inventory.useItem(0)
  assert.equal(inventory.getSnapshot().equipment.bag,'small-bag')
  assert.equal(inventory.getCapacity(),7)
  inventory.unequip('bag');assert.equal(inventory.getSnapshot().equipment.bag,'small-bag')
  inventory.removeItems([stack('item1'),stack('item2')]);inventory.unequip('bag')
  assert.equal(inventory.getCapacity(),6)
  assert.equal(inventory.getSnapshot().items.length,6)
})
test('storing and selling an unequipped bag do not reduce equipped capacity', () => {
  const inventory=setup([stack('bag'),stack('other-bag')]);equip(inventory);inventory.grantItems(fillers(7))
  inventory.openContainer('stash');inventory.storeItem('other-bag')
  assert.equal(inventory.getCapacity(),9)
  inventory.takeItem('other-bag');inventory.openContainer('shop');inventory.storeItem('other-bag')
  assert.equal(inventory.getCapacity(),9)
  assert.equal(inventory.getSnapshot().money,3)
})
test('grants and quest exchanges auto-equip bags but reject rewards exceeding expanded capacity', () => {
  const inventory=setup(fillers(6));const before=inventory.getSnapshot()
  assert.equal(inventory.tryExchangeItems([], [stack('bag'),...fillers(4)],5),false)
  assert.throws(()=>inventory.grantItems([stack('bag'),...fillers(4)]),/equipped bag capacity/)
  assert.equal(inventory.getSnapshot(),before)
  assert.equal(inventory.tryExchangeItems([], [stack('bag')]),true)
  assert.equal(inventory.getCapacity(),9)
})
test('save restore uses saved equipment capacity and rejects carried-bag overflow atomically', () => {
  const inventory=setup([stack('bag')]);equip(inventory);inventory.grantItems(fillers(8))
  const saved=inventory.saveState();const restored=setup();restored.restoreState(saved)
  assert.equal(restored.getCapacity(),9);assert.deepEqual(restored.getSnapshot().items,saved.items)
  const invalid=structuredClone(saved);invalid.equipment={};invalid.items.push(stack('bag'))
  const before=restored.getSnapshot();assert.throws(()=>restored.restoreState(invalid),/equipped bag capacity/)
  assert.equal(restored.getSnapshot(),before)
})
test('bags cannot be consumable or stackable and must configure a positive integer slot bonus', () => {
  for (const patch of [bag=>{bag.inventorySlots=0},bag=>{bag.inventorySlots=1.5},bag=>{bag.consumable=true},bag=>{bag.maxStack=2}]) {
    const {data,sources}=catalogue();patch(data.items.find(item=>item.id==='canvas-backpack'))
    assert.throws(()=>validateContent(data,sources),/canvas-backpack.json/)
  }
})
