import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { roomContainerPlacements } from '../../src/app/content/roomContainerPlacements.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('room 21 floor suitcase stores items across refreshes and save restoration', () => {
  const data = content()
  const placements = roomContainerPlacements(data.locations, data.buildings, data.rooms)
  const placement = placements.find(entry => entry.roomId === 'apartment-21' && entry.id.endsWith(':room-21-storage'))
  assert.ok(placement)
  assert.equal(placement.heightOffset, 0)
  const seeds = buildContainerSeeds({ ...data.containers, placements }, data.items)
  const seed = seeds.find(entry => entry.id === placement.id)
  assert.equal(seed.locked, false)
  assert.equal(seed.loot, undefined)
  assert.deepEqual(seed.items, [])
  const inventory = new InventoryService(data.items, seeds, () => 0)
  inventory.grantItems([{ itemId: 'bread', quantity: 1 }])
  inventory.openContainer(seed.id)
  inventory.storeItem('bread')
  assert.deepEqual(inventory.getSnapshot().containers[seed.id].items, [{ itemId: 'bread', quantity: 1 }])
  inventory.refreshContainers('night')
  inventory.refreshContainers('morning')
  const restored = new InventoryService(data.items, seeds, () => 0)
  restored.restoreState(inventory.saveState())
  restored.openContainer(seed.id)
  restored.takeAll()
  assert.deepEqual(restored.getSnapshot().items, [{ itemId: 'bread', quantity: 1 }])
  assert.deepEqual(restored.getSnapshot().containers[seed.id].items, [])
})

test('room containers inherit building transforms, get separate instance IDs, and retain looted contents', () => {
  const data = content()
  const location = data.locations[0], house = data.buildings.house
  location.buildings.push({ ...location.buildings[0], id: 'second-house', entranceX: 2400, scale: 0.5 })
  const placements = roomContainerPlacements(data.locations, data.buildings, data.rooms)
  const first = placements.find(p => p.buildingId === 'apartments' && p.roomId === 'apartment-21')
  const second = placements.find(p => p.buildingId === 'second-house' && p.roomId === 'apartment-21')
  assert.ok(first && second)
  assert.notEqual(first.id, second.id)
  assert.equal(first.floor, 1)
  assert.equal(second.scale, first.scale / 2)
  const binding = house.rooms.find(room => room.id === 'apartment-21')
  const local = data.rooms[binding.type].containers[0]
  assert.equal(first.x, location.buildings[0].entranceX + (binding.x + local.x - house.entranceX) * house.scale)
  const ids = data.items.map(item => item.id)
  const seeds = buildContainerSeeds({ ...data.containers, placements }, ids).map(seed => ({ ...seed, locked: false }))
  const inventory = new InventoryService(ids, seeds, () => 0)
  inventory.openContainer(first.id)
  inventory.takeAll()
  inventory.closeMenu()
  inventory.openContainer(first.id)
  assert.deepEqual(inventory.getSnapshot().containers[first.id].items, [])
  assert.ok(inventory.getSnapshot().containers[second.id].items.length > 0)
})

test('room container errors point to the room file', () => {
  for (const [patch, pattern] of [
    [{ type: 'missing' }, /type: unknown ID/],
    [{ x: 9999 }, /x: outside room bounds/],
    [{ lootTable: 'missing' }, /lootTable: unknown ID/],
    [{ items: [{ itemId: 'missing', quantity: 1 }] }, /unknown item ID/],
  ]) {
    const { data, sources } = catalogue()
    Object.assign(data.rooms['house-21'].containers[0], patch)
    assert.throws(() => validateContent(data, sources), error => {
      assert.match(error.message, /src\/content\/rooms\/house-21.json/)
      assert.match(error.message, pattern)
      return true
    })
  }
})
