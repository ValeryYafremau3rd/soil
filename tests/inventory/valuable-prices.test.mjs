import assert from 'node:assert/strict'
import test from 'node:test'
import { tradePrice } from '../../src/domain/inventory/trade.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { catalogue } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('all unknown items sell for one; known items use ordinary price rules', () => {
  const item = { price: 40 }
  assert.equal(tradePrice(item, true, { buyPrice: 1, sellPrice: 2 }, false), 1)
  assert.equal(tradePrice(item, true, undefined, true), 20)
  assert.equal(tradePrice(item, false, undefined, false), 40)
  assert.equal(tradePrice({ price: 1 }, true, undefined, true), 1, 'known cheap goods sell for at least one')
})

test('UI prices and sale proceeds agree, and ordinary storage pays nothing', () => {
  let barter = 7
  let erudition = 3
  const item = { id: 'valuable', price: 40, eruditionRequired: 12, skillRequirements: { barter: 8 }, requirementMode: 'any' }
  const make = () => new InventoryService([item], [
    { id: 'shop', name: 'Shop', locationId: 'test', vendor: true, items: [] },
    { id: 'stash', name: 'Stash', locationId: 'test', items: [] },
  ], () => 0, [{ itemId: item.id, quantity: 1 }], undefined, undefined, undefined, undefined, () => erudition,
  false, undefined, undefined, () => ({ barter }))
  const low = make()
  assert.equal(low.getPrice(item.id, true), 1)
  assert.equal(low.understandsItem(item.id), false)
  low.openContainer('shop'); low.storeItem(item.id)
  assert.equal(low.getSnapshot().money, 1)
  low.storeItem(item.id)
  assert.equal(low.getSnapshot().money, 1, 'repeated sale pays nothing')
  barter = 8
  const high = make()
  assert.equal(high.getPrice(item.id, true), 20)
  assert.equal(high.understandsItem(item.id), true)
  high.openContainer('shop'); high.storeItem(item.id)
  assert.equal(high.getSnapshot().money, 20)
  const stored = make()
  stored.openContainer('stash'); stored.storeItem(item.id)
  assert.equal(stored.getSnapshot().money, 0)
  barter = 1
  erudition = 12
  assert.equal(make().getPrice(item.id, true), 20, 'education remains the alternative appraisal route')
})

test('appraisal tiers use Barter; simple first aid and carrying bags need no specialist training', () => {
  const { data, sources } = catalogue()
  for (const item of data.items) {
    if (item.category === 'Valuable' && item.saleable !== false) {
      assert.ok(item.skillRequirements.barter >= 2, item.id)
      assert.equal(item.requirementMode, 'any', item.id)
      assert.ok(item.price >= 8, item.id)
      if (!item.bonus && !item.bonuses?.length && !item.fearResistance) assert.equal(item.rarity, 'common', item.id)
    }
    if (item.category === 'Medical' && !['bandage', 'balm-tin'].includes(item.id)) assert.ok(item.skillRequirements.medicine >= 2, item.id)
    if (item.inventorySlots) assert.equal(item.skillRequirements, undefined, item.id)
  }
  validateContent(data, sources)
  for (const id of ['postcard', 'map', 'letter', 'sealed-documents', 'radio-meter']) {
    assert.equal(data.items.find(item => item.id === id).category, 'Valuable', id)
  }
})

test('unknown gear and medicine also use the one-coin sale price without changing purchase prices', () => {
  const { data } = catalogue()
  let erudition = 1
  const inventory = new InventoryService(data.items, [], () => 0, [], undefined, undefined, undefined, undefined, () => erudition,
    false, undefined, undefined, () => ({ medicine: 1, weapons: 1 }))
  for (const id of ['medical-case', 'service-pistol']) {
    assert.equal(inventory.getPrice(id, true), 1, id)
    assert.equal(inventory.getPrice(id), data.items.find(item => item.id === id).price, id)
  }
  erudition = 20
  assert.equal(inventory.getPrice('medical-case', true), Math.floor(data.items.find(item => item.id === 'medical-case').price / 2))
})
