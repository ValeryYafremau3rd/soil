import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'

const data = content()
const fillers = Array.from({ length: 6 }, () => ({ itemId: 'cloth', quantity: 1 }))

/** Create a currency scenario with live Barter, full ordinary slots and stored cash. */
function setup() {
  let barter = data.skills.legendary.threshold
  const inventory = new InventoryService(data.items, [
    { id: 'shop', vendor: true, items: [{ itemId: 'rope', quantity: 1 }] },
    { id: 'stash', items: [{ itemId: 'money', quantity: 100 }] },
  ], () => 0, fillers, undefined, undefined, undefined, undefined,
  undefined, false, undefined, undefined, () => ({ barter }))
  inventory.syncLegendaryStock()
  return { inventory, losePerk: () => { barter--; inventory.syncLegendaryStock() } }
}

test('legendary cash rewards and pickups use no slots while ordinary items still need room', () => {
  const { inventory } = setup()
  assert.equal(inventory.tryExchangeItems([], [], 205), true)
  assert.equal(inventory.getSnapshot().money, 205)
  assert.equal(inventory.getSnapshot().items.length, 6)
  assert.equal(inventory.getCapacity(), 6)
  inventory.openContainer('stash')
  inventory.takeAll()
  assert.equal(inventory.getSnapshot().money, 305)
  assert.equal(inventory.getSnapshot().containers.stash.items.length, 0)
  inventory.openContainer('shop')
  const before = inventory.getSnapshot()
  inventory.takeItem('rope')
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(inventory.spendMoney(10), true)
  assert.equal(inventory.getSnapshot().money, 295)
  assert.equal(inventory.getSnapshot().items.length, 6)
})

test('slotless money survives save restore and skill loss without granting ordinary capacity', () => {
  const { inventory, losePerk } = setup()
  inventory.grantItems([], 205)
  const saved = inventory.saveState()
  assert.equal(saved.slotlessMoney, true)
  const restored = setup().inventory
  restored.restoreState(saved)
  assert.equal(restored.getSnapshot().money, 205)
  assert.deepEqual(restored.getSnapshot().items, fillers)
  losePerk()
  assert.equal(inventory.getSnapshot().money, 205)
  assert.equal(inventory.getSnapshot().items.length, 9)
  assert.equal(inventory.tryExchangeItems([], [{ itemId: 'rope', quantity: 1 }]), false)
  const ordinary = new InventoryService(data.items, [], () => 0)
  ordinary.restoreState(inventory.saveState())
  assert.equal(ordinary.getSnapshot().money, 205)
  assert.equal(ordinary.getSnapshot().items.length, 9)
  assert.equal(ordinary.spendMoney(5), true)
  assert.equal(ordinary.getSnapshot().money, 200)
  assert.equal(ordinary.removeItems([{ itemId: 'cloth', quantity: 1 }]), true)
})

test('cash-free slot indices survive equipment use and sales pay into the wallet', () => {
  const { inventory } = setup()
  inventory.removeItems(fillers)
  inventory.grantItems([{ itemId: 'pistol-ammunition', quantity: 2 }], 100)
  inventory.openContainer('shop')
  inventory.storeItem('pistol-ammunition', 0)
  assert.ok(inventory.getSnapshot().money > 100)
  assert.deepEqual(inventory.getSnapshot().items,
    [{ itemId: 'pistol-ammunition', quantity: 1 }])
  inventory.closeMenu()
  inventory.openInventory()
  assert.equal(inventory.getSnapshot().items[0].itemId, 'pistol-ammunition')
})
