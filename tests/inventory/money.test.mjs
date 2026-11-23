import test from 'node:test'
import assert from 'node:assert/strict'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { content } from '../helpers/content.mjs'

const stack = (itemId, quantity = 1) => ({ itemId, quantity })
const fillers = count => Array.from({ length: count }, () => stack('cloth'))
function setup(items = [], stock = [stack('rope')]) {
  return new InventoryService(content().items, [
    { id: 'shop', name: 'Shop', locationId: 'test', vendor: true, items: stock },
    { id: 'stash', name: 'Stash', locationId: 'test', items: [] },
  ], () => 0, items)
}

test('money stacks at 100, stored money cannot pay, and deposits survive refresh and save', () => {
  const inventory = setup()
  inventory.grantItems([], 205)
  assert.deepEqual(inventory.getSnapshot().items, [stack('money', 100), stack('money', 100), stack('money', 5)])
  inventory.openContainer('stash')
  inventory.storeItem('money', 0)
  inventory.storeItem('money', 0)
  inventory.storeItem('money', 0)
  assert.equal(inventory.getSnapshot().money, 0)
  inventory.refreshContainers()
  const saved = inventory.saveState()
  const restored = setup()
  restored.restoreState(saved)
  restored.openContainer('shop')
  const before = restored.getSnapshot()
  restored.takeItem('rope')
  assert.equal(restored.getSnapshot(), before)
  restored.openContainer('stash'); restored.takeItem('money', 2)
  assert.equal(restored.getSnapshot().money, 5)
  assert.deepEqual(restored.getSnapshot().containers.stash.items, [stack('money', 100), stack('money', 100)])
})

test('spending the final money frees a purchase slot and failed capacity checks spend nothing', () => {
  const inventory = setup([...fillers(5), stack('money', 4)])
  inventory.openContainer('shop')
  const before = inventory.getSnapshot()
  inventory.takeItem('rope')
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(inventory.spendMoney(1), true)
  inventory.takeItem('rope')
  assert.equal(inventory.getSnapshot().money, 0)
  assert.equal(inventory.getSnapshot().items.length, 6)
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'rope'))
})

test('rewards need complete money capacity and removal plus rewards commit once', () => {
  const inventory = setup([...fillers(5), stack('money', 99)])
  const before = inventory.getSnapshot()
  assert.equal(inventory.tryExchangeItems([], [], 2), false)
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(inventory.tryExchangeItems([stack('cloth')], [], 2), true)
  assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId === 'money'), [stack('money', 100), stack('money', 1)])
})

test('selling a partial stack needs room for proceeds, then succeeds after space is made', () => {
  const inventory = setup([...fillers(5), stack('pistol-ammunition', 2)])
  inventory.openContainer('shop')
  const before = inventory.getSnapshot()
  inventory.storeItem('pistol-ammunition', 5)
  assert.equal(inventory.getSnapshot(), before)
  inventory.removeItems([stack('cloth')])
  inventory.storeItem('pistol-ammunition', 4)
  assert.equal(inventory.getSnapshot().money, inventory.getPrice('pistol-ammunition', true))
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'pistol-ammunition').quantity, 1)
})

test('requirement previews do not emit notifications', () => {
  const messages = []
  const inventory = new InventoryService([{ id: 'book', eruditionRequired: 10 }], [], () => 0, [], undefined,
    undefined, undefined, text => messages.push(text), () => 1)
  assert.equal(inventory.meetsItemRequirements('book'), false)
  assert.equal(inventory.meetsItemRequirements('missing'), false)
  assert.deepEqual(messages, [])
})

test('legacy wallet migration keeps collectible coins separate and refuses to discard money when full', () => {
  const inventory = setup([stack('coins')])
  const legacy = inventory.saveState()
  delete legacy.currencyInInventory
  legacy.money = 120
  inventory.restoreState(legacy)
  assert.deepEqual(inventory.getSnapshot().items, [stack('coins'), stack('money', 100), stack('money', 20)])
  const restored = setup()
  restored.restoreState(inventory.saveState())
  assert.equal(restored.getSnapshot().money, 120, 'new saves do not grant the wallet again')
  legacy.items = fillers(6)
  const before = inventory.getSnapshot()
  assert.throws(() => inventory.restoreState(legacy), /room for saved Thalers/)
  assert.equal(inventory.getSnapshot(), before)
})
