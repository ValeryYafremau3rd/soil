import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { isContainerObserved } from '../../src/domain/inventory/looting.ts'
import { resolveNpcPlacements } from '../../src/app/content/resolveNpcPlacements.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'

test('witnesses block the same room or shared building interior without seeing through private rooms', () => {
  const room = { space: 'inside', buildingId: 'house', roomId: 'room-21' }
  assert.equal(isContainerObserved(room, [{ buildingId: 'house', roomId: 'room-21' }]), true)
  assert.equal(isContainerObserved(room, [{ buildingId: 'house', roomId: 'room-22' }]), false)
  assert.equal(isContainerObserved(room, [{ buildingId: 'house' }]), false)
  assert.equal(isContainerObserved(room, [{ buildingId: 'other', roomId: 'room-21' }]), false)
  assert.equal(isContainerObserved({ space: 'inside', buildingId: 'house' }, [{ buildingId: 'house' }]), true)
  assert.equal(isContainerObserved({ space: 'inside', buildingId: 'house' }, [{ buildingId: 'house', roomId: 'room-21' }]), false)
  assert.equal(isContainerObserved({ space: 'outside' }, [{}]), false)
  assert.equal(isContainerObserved(room, []), false)
})

test('authored schedules block occupied buildings and rooms only while their residents are present', () => {
  const { npcs, locations } = content()
  const people = (location, phase, definitions = npcs) => resolveNpcPlacements(definitions, locations, location, phase)
  const factory = { space: 'inside', buildingId: 'factory-main' }
  assert.equal(isContainerObserved(factory, people('factory', 'morning')), true)
  assert.equal(isContainerObserved(factory, people('factory', 'afternoon')), true)
  assert.equal(isContainerObserved(factory, people('factory', 'evening')), false)
  const apartment11 = { space: 'inside', buildingId: 'apartments', roomId: 'apartment-11' }
  assert.equal(isContainerObserved(apartment11, people('living-district', 'night')), true)
  assert.equal(isContainerObserved(apartment11, people('living-district', 'morning')), false)
  assert.equal(isContainerObserved({ ...apartment11, roomId: 'apartment-21' }, people('living-district', 'night')), false)
  const disabled = structuredClone(npcs)
  disabled.stranger.schedule.night.enabled = false
  assert.equal(isContainerObserved(apartment11, people('living-district', 'night', disabled)), false)
})

function setup() {
  let observed = true, attempts = 0
  const messages = []
  const items = [{ id: 'loot', price: 1 }, { id: 'own', price: 1 }]
  const containers = [
    { id: 'room', name: 'Room crate', locationId: 'test', items: [{ itemId: 'loot', quantity: 1 }] },
    { id: 'locked', name: 'Locked crate', locationId: 'test', locked: true },
    { id: 'vendor', name: 'Shop', locationId: 'test', vendor: true, items: [{ itemId: 'loot', quantity: 1 }] },
  ]
  const inventory = new InventoryService(items, containers, () => 0, [{ itemId: 'own', quantity: 1 }],
    undefined, undefined, () => { attempts++ }, message => messages.push(message), undefined, false, () => !observed)
  return { inventory, messages, observe: value => { observed = value }, attempts: () => attempts }
}

test('observed containers refuse opening and lockpicking, show the hero message, and preserve other windows', () => {
  const { inventory, messages, observe, attempts } = setup()
  inventory.openInventory()
  const before = inventory.getSnapshot()
  inventory.openContainer('room')
  inventory.openContainer('locked')
  assert.equal(inventory.getSnapshot(), before)
  assert.equal(attempts(), 0, 'witness check runs before lockpicking')
  assert.deepEqual(messages, ["I can't do that when others see me.", "I can't do that when others see me."])
  observe(false)
  inventory.openContainer('room')
  inventory.takeAll()
  assert.deepEqual(inventory.getSnapshot().containers.room.items, [])
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'loot'))
})

test('barter remains available in occupied shops and still charges money', () => {
  const { inventory, messages } = setup()
  inventory.grantItems([], 2)
  inventory.openContainer('vendor')
  inventory.takeItem('loot', 0)
  assert.equal(inventory.getSnapshot().money, 1)
  assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'loot'))
  assert.deepEqual(messages, [])
})
