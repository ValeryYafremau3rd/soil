import assert from 'node:assert/strict'
import test from 'node:test'
import { StatisticsService } from '../../src/app/services/progression/StatisticsService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'

test('statistics preserve fractional distance, reject invalid increments and restore independently', () => {
  const totals = new StatisticsService()
  totals.record('distance', 1.25)
  for (const value of [0, -1, NaN, Infinity]) totals.record('distance', value)
  totals.record('alcoholDrunk')
  const loaded = new StatisticsService(totals.getSnapshot())
  loaded.record('distance', 2.5)
  assert.equal(loaded.getSnapshot().distance, 3.75)
  assert.equal(totals.getSnapshot().distance, 1.25)
  assert.equal(loaded.getSnapshot().alcoholDrunk, 1)
  assert.deepEqual(new StatisticsService().getSnapshot(), {})
})

test('transactions count only committed payments and purchases; storage is free', () => {
  const totals = new StatisticsService()
  const inventory = new InventoryService([{ id: 'food', price: 4, maxStack: 5 }], [
    { id: 'shop', name: 'Shop', vendor: true, items: [{ itemId: 'food', quantity: 3 }] },
    { id: 'stash', name: 'Stash', items: [] },
  ], () => 0)
  inventory.grantItems([], 10)
  inventory.onStatistic = totals.record
  assert.equal(inventory.spendMoney(11), false)
  assert.equal(inventory.spendMoney(0), true)
  inventory.openContainer('shop')
  inventory.takeItem('food')
  assert.equal(totals.getSnapshot().moneySpent, 4)
  assert.equal(totals.getSnapshot().itemsBought, 1)
  inventory.openContainer('stash')
  inventory.storeItem('food')
  inventory.takeItem('food')
  assert.equal(totals.getSnapshot().moneyEarned, undefined)
  assert.equal(totals.getSnapshot().moneySpent, 4)
  inventory.openContainer('shop')
  inventory.storeItem('food')
  assert.equal(totals.getSnapshot().moneyEarned, 2)
  assert.equal(inventory.tryExchangeItems([{itemId:'food',quantity:99}], [], 20), false)
  assert.equal(totals.getSnapshot().moneyEarned, 2)
  assert.equal(inventory.tryExchangeItems([], [], 3), true)
  assert.equal(totals.getSnapshot().moneyEarned, 5)
})

test('scrapping counts a consumed item even when no reward is recovered', () => {
  const inventory = new InventoryService([{ id: 'junk', scrap: true }], [], () => 0.999, [{itemId:'junk',quantity:1}])
  const totals = new StatisticsService()
  inventory.onStatistic = totals.record
  inventory.useItem(0)
  inventory.useItem(0)
  assert.equal(totals.getSnapshot().itemsScrapped, 1)
})

test('full inventory rejects purchases without recording payment or items', () => {
  const inventory = new InventoryService([{ id: 'food', price: 4, maxStack: 1 }], [
    { id: 'shop', name: 'Shop', vendor: true, items: [{ itemId: 'food', quantity: 1 }] },
  ], () => 0, [...Array.from({length:5},()=>({itemId:'food',quantity:1})), {itemId:'money',quantity:10}])
  const totals = new StatisticsService()
  inventory.onStatistic = totals.record
  inventory.openContainer('shop')
  inventory.takeItem('food')
  assert.equal(inventory.getSnapshot().money, 10)
  assert.deepEqual(totals.getSnapshot(), {})
})

test('discrete actions reject fractional increments while damage retains precision', () => {
  const totals = new StatisticsService()
  totals.record('alcoholDrunk', 0.5)
  totals.record('damageTaken', 0.25)
  totals.record('unknownCounter')
  assert.deepEqual(totals.getSnapshot(), { damageTaken: 0.25 })
})
