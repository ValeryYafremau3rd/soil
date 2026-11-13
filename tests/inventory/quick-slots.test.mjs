import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { itemWeaponKind } from '../../src/domain/inventory/items.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue } from '../helpers/content.mjs'

test('closed-menu consumption targets the indexed stack and preserves failed uses', () => {
  let allowed = false
  let recoveries = 0
  const inventory = new InventoryService([
    { id: 'food', consumable: true, maxStack: 5, recovery: { energy: 10 } },
    { id: 'bag', inventorySlots: 3 },
  ], [], () => 0, [
    { itemId: 'bag', quantity: 1 },
    ...Array.from({ length: 7 }, () => ({ itemId: 'food', quantity: 5 })),
    { itemId: 'food', quantity: 2 },
  ], { recover: () => { recoveries++; return allowed } })
  const before = inventory.getSnapshot().items
  inventory.useItem(8)
  assert.deepEqual(inventory.getSnapshot().items, before)
  allowed = true
  inventory.useItem(8)
  assert.equal(inventory.getSnapshot().items[8].quantity, 1)
  assert.equal(inventory.getSnapshot().items[1].quantity, 5)
  inventory.useItem(8)
  assert.equal(inventory.getSnapshot().items.length, 8)
  for (const slot of [8, -1, 0.5, NaN, 0]) inventory.useItem(slot)
  assert.equal(recoveries, 3)
  assert.equal(inventory.getSnapshot().menu, null)
})

test('weapon slots request attacks without consumption and respect requirements, menus and unsubscribe', () => {
  const inventory = new InventoryService([
    { id: 'knife', damageMultiplier: 0.9, bonus: { skill: 'martialArts', amount: 1 } },
    { id: 'gun', firearm: { ammunitionId: 'round' } },
    { id: 'locked', firearm: { ammunitionId: 'round' }, eruditionRequired: 20 },
    { id: 'round', ammunition: true, maxStack: 5 },
  ], [], () => 0, ['knife', 'gun', 'locked'].map(itemId => ({ itemId, quantity: 1 })))
  const events = []
  const unsubscribe = inventory.subscribeWeaponUse((...event) => events.push(event))
  inventory.useItem(0)
  inventory.useItem(1)
  inventory.useItem(2)
  assert.deepEqual(events, [['knife', 'melee', true], ['gun', 'shot', true]])
  inventory.releaseWeapon()
  assert.deepEqual(events[2], ['', 'melee', false])
  inventory.openInventory()
  inventory.useItem(0)
  inventory.closeMenu()
  unsubscribe()
  inventory.useItem(1)
  assert.equal(events.length, 3)
  assert.equal(inventory.getSnapshot().items.length, 3)
  assert.equal(inventory.getWeaponDamageMultiplier('melee', 'knife'), 0.9)
})

test('firing a specific gun uses only its ammunition and never falls back to another gun', () => {
  const inventory = new InventoryService([
    { id: 'gun-a', damageMultiplier: 0.9, firearm: { ammunitionId: 'a' } },
    { id: 'gun-b', damageMultiplier: 1.5, firearm: { ammunitionId: 'b' } },
    { id: 'a', ammunition: true, maxStack: 5 },
    { id: 'b', ammunition: true, maxStack: 5 },
  ], [], () => 0, ['gun-a', 'gun-b', 'a', 'b'].map(itemId => ({ itemId, quantity: 1 })))
  assert.equal(inventory.getWeaponDamageMultiplier('shot', 'gun-b'), 1.5)
  assert.equal(inventory.getWeaponDamageMultiplier('shot'), 1.5)
  assert.equal(inventory.tryShoot('gun-b'), true)
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'a'), true)
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'b'), false)
  assert.equal(inventory.tryShoot('gun-b'), false)
  assert.equal(inventory.tryShoot('gun-a'), true)
  assert.equal(inventory.getWeaponDamageMultiplier('shot'), 1)
})

test('authored weapon multipliers stay in range and training books never trigger melee', () => {
  const data = catalogue().data
  const weapons = data.items.filter(item => itemWeaponKind(item))
  assert.equal(weapons.length, 9)
  assert.equal(Math.min(...weapons.map(item => item.damageMultiplier)), 1)
  assert.equal(Math.max(...weapons.map(item => item.damageMultiplier)), 1.5)
  assert.equal(itemWeaponKind(data.items.find(item => item.id === 'martialArts-training-handbook')), undefined)
  for (const id of ['knife', 'compact-pistol']) {
    for (const value of [0.9, 0.99, 1.6, undefined]) {
      const invalid = structuredClone(data)
      invalid.items.find(item => item.id === id).damageMultiplier = value
      assert.throws(() => validateContent(invalid), /damageMultiplier/)
    }
    const minimum = structuredClone(data)
    minimum.items.find(item => item.id === id).damageMultiplier = 1
    assert.doesNotThrow(() => validateContent(minimum))
  }
})

test('automatic attacks choose the strongest eligible weapon and spend its matching ammunition', () => {
  let education = 0
  const inventory = new InventoryService([
    { id: 'weak', damageMultiplier: 0.9 },
    { id: 'strong', damageMultiplier: 1.3 },
    { id: 'locked', damageMultiplier: 1.5, eruditionRequired: 10 },
    { id: 'gun-a', damageMultiplier: 0.9, firearm: { ammunitionId: 'a' } },
    { id: 'gun-b', damageMultiplier: 1.5, firearm: { ammunitionId: 'b' } },
    { id: 'a', ammunition: true, maxStack: 5 },
    { id: 'b', ammunition: true, maxStack: 5 },
    { id: 'bag', inventorySlots: 3 },
  ], [], () => 0, ['weak', 'strong', 'locked', 'gun-a', 'gun-b', 'a', 'b', 'bag'].map(itemId => ({ itemId, quantity: 1 })),
  undefined, undefined, undefined, undefined, () => education)
  assert.equal(inventory.getWeaponDamageMultiplier('melee'), 1.3)
  assert.equal(inventory.getWeaponDamageMultiplier('melee', 'weak'), 0.9)
  education = 10
  assert.equal(inventory.getWeaponDamageMultiplier('melee'), 1.5)
  assert.equal(inventory.getWeaponDamageMultiplier('shot'), 1.5)
  assert.equal(inventory.tryShoot(), true)
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'b'), false)
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'a'), true)
  assert.equal(inventory.getWeaponDamageMultiplier('shot'), 0.9)
  assert.equal(inventory.tryShoot(), true)
  assert.equal(inventory.tryShoot(), false)
})
