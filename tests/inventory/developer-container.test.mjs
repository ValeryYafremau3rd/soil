import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'

test('developer safe in the top-floor hall includes the whole catalogue and stays depleted after use', () => {
  const data = content()
  const placements = data.containers.placements
  const placement = placements.find(placement => placement.developerStock)
  assert.equal(placement.roomId, undefined)
  assert.equal(placement.floor, 4)
  assert.equal(placement.type, 'safe')
  const seeds = buildContainerSeeds({ ...data.containers, placements }, data.items)
  const seed = seeds.find(seed => seed.id === placement.id)
  assert.equal(seed.locationId, 'living-district')
  assert.equal(seed.locked, false)
  assert.deepEqual(seed.items.map(item => item.itemId).sort(), data.items.map(item => item.id).sort())
  assert.ok(seed.items.every(item => item.quantity === (data.items.find(definition => definition.id === item.itemId).maxStack ?? 1)))
  const inventory = new InventoryService(data.items, seeds, () => 0)
  const stock = () => inventory.getSnapshot().containers[seed.id].items
  assert.equal(stock().length, data.items.length)
  inventory.openContainer(seed.id)
  assert.equal(inventory.getSnapshot().menu?.containerId, seed.id)
  inventory.takeItem('bread')
  assert.ok(!stock().some(item => item.itemId === 'bread'))
  inventory.closeMenu()
  inventory.openContainer(seed.id)
  assert.ok(!stock().some(item => item.itemId === 'bread'))
  inventory.refreshContainers('night')
  assert.ok(!stock().some(item => item.itemId === 'bread'))
  inventory.refreshContainers('morning')
  assert.ok(!stock().some(item => item.itemId === 'bread'))
  assert.equal(stock().find(item => item.itemId === 'money').quantity, 100)
  inventory.refreshContainers('morning')
  assert.equal(stock().length, data.items.length - 1)
})
