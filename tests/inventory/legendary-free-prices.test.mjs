import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { content } from '../helpers/content.mjs'

test('legendary Barter waives eligible prices in both directions and updates with skill loss', () => {
  const data = content()
  let barter = data.skills.legendary.threshold
  const inventory = new InventoryService(
    data.items, [], () => 0, [], undefined, undefined, undefined, undefined,
    undefined, false, undefined, undefined, () => ({ barter })
  )
  const goods = data.items.filter(item => ['Food', 'Drink', 'Medical'].includes(item.category)
    || ['red-cigarettes', 'grey-cigarettes', 'matches'].includes(item.id))
  assert.ok(goods.length > 5)
  for (const item of goods) {
    assert.equal(inventory.getPrice(item.id), 0, item.id)
    assert.equal(inventory.getPrice(item.id, true), 0, item.id)
  }
  assert.ok(inventory.getPrice('pistol-ammunition') > 0)
  barter--
  assert.ok(inventory.getPrice(goods[0].id) > 0)
  assert.ok(inventory.getPrice('matches') > 0)
})

for (const itemId of ['red-cigarettes', 'matches']) {
  test(`free ${itemId} purchases and sales transfer goods without creating money`, () => {
    const data = content()
    const inventory = new InventoryService(
      data.items, [{ id: 'free-vendor', vendor: true, items: [{ itemId, quantity: 2 }] }],
      () => 0, [], undefined, undefined, undefined, undefined,
      undefined, false, undefined, undefined, () => ({ barter: data.skills.legendary.threshold })
    )
    inventory.openContainer('free-vendor')
    inventory.takeItem(itemId, 0)
    assert.equal(inventory.getSnapshot().money, 0)
    assert.equal(inventory.getSnapshot().items.find(item => item.itemId === itemId)?.quantity, 1)
    inventory.storeItem(itemId)
    assert.equal(inventory.getSnapshot().money, 0)
    assert.equal(inventory.getSnapshot().items.some(item => item.itemId === itemId), false)
  })
}
