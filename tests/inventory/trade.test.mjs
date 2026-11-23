import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { tradePrice } from '../../src/domain/inventory/trade.ts'
import { validateClasses } from '../../src/domain/skills/character.ts'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

const definitions = [{ id: 'food', price: 3, maxStack: 5 }, { id: 'junk', price: 1 }]
test('non-saleable goods cannot be sold but can be stored in an ordinary container', () => {
  const messages = []
  const inventory = new InventoryService([{ id: 'key', price: 10, saleable: false }], [
    { id: 'shop', name: 'Shop', vendor: true, locationId: 'center', items: [] },
    { id: 'stash', name: 'Stash', locationId: 'center', items: [] },
  ], () => 0, [{ itemId: 'key', quantity: 1 }], undefined, undefined, undefined, text => messages.push(text))
  inventory.openContainer('shop')
  const before = inventory.getSnapshot(), saved = inventory.saveState()
  inventory.storeItem('key', 0)
  assert.equal(inventory.getSnapshot(), before)
  assert.deepEqual(inventory.saveState(), saved)
  assert.match(messages[0], /can't sell/)
  inventory.openContainer('stash'); inventory.storeItem('key', 0)
  assert.deepEqual(inventory.getSnapshot().items, [])
  assert.deepEqual(inventory.getSnapshot().containers.stash.items, [{ itemId: 'key', quantity: 1 }])
})

test('authored keys and quest goods cannot be sold and saleable must be boolean', () => {
  const data = content()
  for (const item of data.items.filter(item => item.keys || item.id === 'small-key' || item.category === 'Quest')) {
    assert.equal(item.saleable, false, item.id)
  }
  data.items[0].saleable = 'false'
  assert.throws(() => validateContent(data), /saleable/)
})
function setup(vendor = true, money = 20, items = []) {
  const inventory = new InventoryService(definitions, [{ id: 'shop', name: 'Shop', locationId: 'center', vendor,
    items: [{ itemId: 'food', quantity: 3 }] }], () => 0, items)
  inventory.grantItems([], money)
  inventory.openContainer('shop')
  return inventory
}

test('sale prices round down per item with a minimum of one', () => {
  for (const [price, expected] of [[1, 1], [2, 1], [3, 1], [5, 2]]) {
    assert.equal(tradePrice({ price }, true), expected)
  }
  assert.equal(tradePrice({ price: 5 }, true, { buyPrice: 1, sellPrice: 0 }), 1)
  assert.equal(tradePrice({ price: 5 }, true, { buyPrice: 1, sellPrice: 2 }), 5)
  const inventory = setup(true, 0, [{ itemId: 'junk', quantity: 1 }])
  inventory.storeItem('junk', 0)
  assert.equal(inventory.getSnapshot().money, 1)
  assert.deepEqual(inventory.getSnapshot().items, [{ itemId: 'money', quantity: 1 }])
})

test('unaffordable purchases and vendor bulk/swap attempts change nothing', () => {
  const inventory = setup(true, 2, [{ itemId: 'junk', quantity: 1 }])
  const before = inventory.getSnapshot()
  inventory.takeItem('food', 0)
  inventory.takeAll()
  inventory.swapItems('junk', 'food')
  assert.equal(inventory.getSnapshot(), before)
})

test('buying and selling charges per unit and cannot earn money on a round trip', () => {
  const inventory = setup()
  inventory.takeItem('food', 0)
  assert.equal(inventory.getSnapshot().money, 17)
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'food').quantity, 1)
  assert.equal(inventory.getSnapshot().containers.shop.items[0].quantity, 2)
  inventory.storeItem('food')
  assert.equal(inventory.getSnapshot().money, 18)
  inventory.refreshContainers()
  assert.equal(inventory.getSnapshot().money, 18)
})

test('full inventory rejects purchases; partial stack capacity charges only received goods', () => {
  const inventory = setup(true, 20, [{ itemId: 'food', quantity: 4 }, ...Array.from({ length: 4 }, () => ({ itemId: 'junk', quantity: 1 }))])
  inventory.takeItem('food', 0)
  assert.equal(inventory.getSnapshot().money, 17)
  assert.equal(inventory.getSnapshot().items[0].quantity, 5)
  assert.equal(inventory.getSnapshot().containers.shop.items[0].quantity, 2)
  const before = inventory.getSnapshot()
  inventory.takeItem('food', 0)
  assert.equal(inventory.getSnapshot(), before)
})

test('vendor sells one unit even when the player can only afford one from a larger stack', () => {
  const inventory = setup(true, 3)
  inventory.takeItem('food', 0)
  assert.equal(inventory.getSnapshot().money, 0)
  assert.deepEqual(inventory.getSnapshot().items, [{ itemId: 'food', quantity: 1 }])
  assert.equal(inventory.getSnapshot().containers.shop.items[0].quantity, 2)
  const before = inventory.getSnapshot()
  inventory.takeItem('food', 0)
  assert.equal(inventory.getSnapshot(), before)
})

test('selling a selected partial stack transfers exactly one and preserves other same-item slots', () => {
  const inventory = setup(true, 0, [{ itemId: 'food', quantity: 5 }, { itemId: 'food', quantity: 2 }])
  inventory.storeItem('food', 1)
  assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId !== 'money').map(item => item.quantity), [5, 1])
  assert.equal(inventory.getSnapshot().money, 1)
  assert.equal(inventory.getSnapshot().containers.shop.items[0].quantity, 4)
  inventory.storeItem('food', 1)
  assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId !== 'money').map(item => item.quantity), [5])
  assert.equal(inventory.getSnapshot().money, 2)
  const before = inventory.getSnapshot()
  inventory.storeItem('food', 1)
  assert.equal(inventory.getSnapshot(), before)
})

test('container transfers remain free in both directions', () => {
  const inventory = setup(false, 0)
  inventory.takeAll()
  assert.equal(inventory.getSnapshot().items[0].quantity, 3)
  inventory.storeItem('food', 0)
  assert.equal(inventory.getSnapshot().money, 0)
})

test('classes have distinct small starting balances and valuables have higher prices than ordinary goods', () => {
  const classes = JSON.parse(readFileSync(new URL('../../src/content/classes.json', import.meta.url), 'utf8'))
  const input = content()
  validateClasses(classes, input.items.map(item => item.id))
  assert.equal(new Set(classes.map(entry => entry.startingItemQuantities.money)).size, 3)
  for (const entry of classes) {
    const inventory = setup(false, 0)
    inventory.grantItems([], entry.startingItemQuantities.money)
    assert.equal(inventory.getSnapshot().money, entry.startingItemQuantities.money)
  }
  for (const price of [undefined, -1, 1.5]) {
    const invalid = structuredClone(input)
    invalid.items[0].price = price
    assert.throws(() => validateContent(invalid), /price/)
  }
  assert.ok(input.items.every(item => Number.isInteger(item.price) && item.price >= 1 && item.price < 100))
  assert.throws(() => validateClasses([{ ...classes[0], startingItemQuantities: { money: -1 } }], input.items.map(item => item.id)), /quantity/)
})
