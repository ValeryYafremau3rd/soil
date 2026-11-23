import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue, content } from '../helpers/content.mjs'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { roomContainerPlacements } from '../../src/app/content/roomContainerPlacements.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { LockpickingService } from '../../src/app/services/puzzles/LockpickingService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { MessageService } from '../../src/app/services/ui/MessageService.ts'

test('container locks default to false, inherit from types, and allow placement overrides including rooms', () => {
  const data = content()
  const room = data.rooms['house-21'].containers[0]
  data.containers.types[room.type].locked = true
  room.locked = false
  const placements = roomContainerPlacements(data.locations, data.buildings, data.rooms)
  const piece = placements.find(p => p.roomId === 'apartment-21')
  const config = { ...data.containers, placements: [piece, { ...piece, id: 'inherited', locked: undefined }] }
  assert.deepEqual(buildContainerSeeds(config, data.items).map(seed => seed.locked), [false, true])
  delete data.containers.types[room.type].locked
  assert.deepEqual(buildContainerSeeds(config, data.items).map(seed => seed.locked), [false, false])
})

test('strict content validation rejects nonboolean locked fields', () => {
  for (const target of ['type', 'placement', 'room']) {
    const { data, sources } = catalogue()
    const object = target === 'type' ? data.containers.types.suitcase
      : target === 'placement' ? data.containers.placements[0] : data.rooms['house-21'].containers[0]
    object.locked = 'yes'
    assert.throws(() => validateContent(data, sources), /locked/)
  }
})

function setup(picks = 3) {
  let now = 0
  let locks
  const messages = new MessageService()
  const inventory = new InventoryService([{ id: 'lockpick', consumable: true, maxStack: 3 }, { id: 'loot' }], [
    { id: 'locked', name: 'Locked chest', locationId: 'test', locked: true, items: [{ itemId: 'loot', quantity: 1 }] },
    { id: 'open', name: 'Open chest', locationId: 'test', locked: false, items: [] },
  ], () => 0, picks ? [{ itemId: 'lockpick', quantity: picks }] : [], undefined, undefined,
  (id, name, onUnlocked) => locks.attemptContainer(id, name, onUnlocked))
  const time = new DayTimeService(1, 'morning')
  locks = new LockpickingService(time, () => 0, { lockpickingBaseSeconds: 1, lockpickingSecondsPerPoint: 1 },
    { has: () => inventory.getSnapshot().items.some(item => item.itemId === 'lockpick'), consume: () => inventory.consumeItem('lockpick') }, () => now, () => 0, messages.show)
  return { inventory, locks, time, messages, expire: () => { now += 1000; locks.tick() } }
}

test('locked containers require lockpicking during daytime and remain closed after success until interacted again', () => {
  const { inventory, locks, time } = setup()
  inventory.openContainer('locked')
  assert.equal(inventory.getSnapshot().menu, null)
  inventory.takeAll()
  assert.equal(inventory.getSnapshot().containers.locked.items.length, 1)
  assert.ok(locks.getSnapshot().puzzle)
  locks.setNumber(0, 2)
  assert.equal(inventory.getSnapshot().containers.locked.locked, true, 'matching sum does not auto-confirm')
  locks.submit()
  assert.equal(inventory.getSnapshot().containers.locked.locked, false)
  assert.equal(inventory.getSnapshot().menu, null)
  assert.equal(inventory.getSnapshot().items[0].quantity, 3)
  inventory.refreshContainers()
  time.nextMorning()
  inventory.openContainer('locked')
  assert.equal(inventory.getSnapshot().menu.containerId, 'locked')
  assert.equal(locks.getSnapshot().puzzle, null)
})

test('failure spends one lockpick, retains the lock and loot, and unlocked containers bypass the puzzle', () => {
  const { inventory, locks, expire } = setup()
  inventory.openContainer('locked')
  expire()
  assert.equal(inventory.getSnapshot().containers.locked.locked, true)
  assert.equal(inventory.getSnapshot().containers.locked.items.length, 1)
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  inventory.openContainer('locked')
  locks.close()
  assert.equal(inventory.getSnapshot().items[0].quantity, 1)
  inventory.refreshContainers()
  assert.equal(inventory.getSnapshot().containers.locked.locked, true)
  inventory.openContainer('open')
  assert.equal(inventory.getSnapshot().menu.containerId, 'open')
  assert.equal(locks.getSnapshot().puzzle, null)
})

test('no lockpick or no configured lock handler cannot open a locked container', () => {
  const { inventory, locks, messages } = setup(0)
  inventory.openContainer('locked')
  assert.equal(inventory.getSnapshot().menu, null)
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.match(messages.getSnapshot().messages.at(-1).text, /required/)
  const isolated = new InventoryService(['loot'], [{ id: 'locked', name: 'Chest', locationId: 'test', locked: true }])
  isolated.openContainer('locked')
  assert.equal(isolated.getSnapshot().menu, null)
})

test('a wrong submission breaks one lockpick without unlocking a container or changing its loot', () => {
  const { inventory, locks } = setup()
  inventory.openContainer('locked')
  const loot = inventory.getSnapshot().containers.locked.items
  locks.submit()
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  assert.equal(inventory.getSnapshot().containers.locked.locked, true)
  assert.deepEqual(inventory.getSnapshot().containers.locked.items, loot)
  locks.submit()
  locks.close()
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  inventory.openContainer('locked')
  assert.ok(locks.getSnapshot().puzzle, 'the container still requires a new attempt')
})
