import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { content } from '../helpers/content.mjs'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { buildVendorSeeds } from '../../src/app/content/vendorSeeds.ts'
import { roomContainerPlacements } from '../../src/app/content/roomContainerPlacements.ts'

test('finite outdoor rewards exist by day and remain depleted across nights, mornings and saves', () => {
  const seed = { id:'reward', name:'Reward', locationId:'test', space:'outside', restock:false, items:[{itemId:'book',quantity:1}] }
  const inventory = new InventoryService(['book'], [seed])
  inventory.openContainer('reward'); inventory.takeAll(); inventory.closeMenu()
  inventory.refreshContainers('night'); inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers.reward.items, [])
  const loaded = new InventoryService(['book'], [seed])
  loaded.restoreState(inventory.saveState()); loaded.refreshContainers()
  assert.deepEqual(loaded.getSnapshot().containers.reward.items, [])
})

test('vendor purchases deplete fixed gear while stackable staples refill', () => {
  const definitions=[{id:'book',price:0,maxStack:1},{id:'food',price:0,maxStack:3}]
  const seed={id:'vendor',name:'Vendor',locationId:'test',vendor:true,items:[{itemId:'book',quantity:1},{itemId:'food',quantity:3}]}
  const inventory=new InventoryService(definitions,[seed])
  inventory.grantItems([],10)
  inventory.openContainer('vendor'); inventory.takeItem('book',0); inventory.takeItem('food',0)
  inventory.refreshContainers(); inventory.refreshContainers()
  assert.deepEqual(inventory.getSnapshot().containers.vendor.items,[{itemId:'food',quantity:3}])
})

test('permanent buffs have finite sources or legendary Dusan stock and never reroll in ordinary renewable loot', () => {
  const data = content()
  const definitions = new Map(data.items.map(item => [item.id, item]))
  const buffs = data.items.filter(item => !item.consumable && (item.bonus || item.bonuses?.length || item.fearResistance || item.stealthModifier))
  const seeds = buildContainerSeeds({ ...data.containers,
    placements: data.containers.placements.filter(piece => !piece.developerStock),
  }, data.items)
  const vendors = buildVendorSeeds(data.dialogues, data.items)
  const roomSeeds = buildContainerSeeds({ ...data.containers,
    placements: roomContainerPlacements(data.locations, data.buildings, data.rooms),
  }, data.items)
  for (const seed of roomSeeds.filter(seed => seed.items.some(stack => buffs.some(item => item.id === stack.itemId)))) {
    assert.equal(seed.restock, false, `${seed.id}: room gear must be finite, including developer stock`)
  }
  for (const item of buffs) {
    assert.ok(item.saleable !== false || [...vendors, ...seeds.filter(seed => seed.restock === false)]
      .some(seed => seed.items.some(stack => stack.itemId === item.id)), `${item.id}: missing finite or legendary vendor source`)
    for (const seed of seeds.filter(seed => seed.restock !== false)) {
      assert.ok(!seed.items.some(stack => stack.itemId === item.id), `${item.id}: renewable fixed stock in ${seed.id}`)
      assert.ok(!seed.loot?.itemIds.includes(item.id), `${item.id}: renewable random loot in ${seed.id}`)
    }
    for (const vendor of vendors) {
      if (vendor.items.some(stack => stack.itemId === item.id)) assert.equal(definitions.get(item.id).maxStack ?? 1, 1,
        `${item.id}: vendor gear must retain depleted stock`)
      assert.ok(!vendor.loot?.itemIds.includes(item.id), `${item.id}: renewable vendor random stock`)
    }
  }
})

test('ordinary apartment permanent buffs are kept in safes and relocated rewards never replenish', () => {
  const data = content()
  const definitions = new Map(data.items.map(item => [item.id, item]))
  const placements = [...data.containers.placements, ...roomContainerPlacements(data.locations, data.buildings, data.rooms)]
    .filter(piece => piece.roomId && !piece.developerStock)
  for (const piece of placements) {
    for (const stack of piece.items ?? []) {
      const item = definitions.get(stack.itemId)
      if (item.consumable || !(item.bonus || item.bonuses?.length || item.fearResistance || item.stealthModifier)) continue
      assert.equal(piece.type, 'safe', `${piece.id}: permanent buff must be in a safe`)
      assert.equal(piece.restock, false, `${piece.id}: permanent buff must not replenish`)
    }
  }
  const destinations = new Set()
  for (const itemId of ['weapons-training-magazine', 'pliers', 'smuggler-lock-guide', 'repair-pliers']) {
    const sources = placements.filter(piece => piece.items?.some(stack => stack.itemId === itemId))
    assert.equal(sources.length, 1, `${itemId}: relocation must not duplicate or lose the item`)
    const seed = buildContainerSeeds({ ...data.containers, placements: sources }, data.items)[0]
    destinations.add(seed.id)
    const seeds = [{ ...seed, locked: false }]
    const inventory = new InventoryService(data.items, seeds)
    inventory.openContainer(seed.id)
    inventory.takeItem(itemId)
    assert.equal(inventory.getSnapshot().items.find(stack => stack.itemId === itemId)?.quantity, 1)
    inventory.refreshContainers()
    inventory.refreshContainers('night')
    const restored = new InventoryService(data.items, seeds)
    restored.restoreState(inventory.saveState())
    restored.refreshContainers()
    assert.ok(!restored.getSnapshot().containers[seed.id].items.some(stack => stack.itemId === itemId))
  }
  assert.equal(destinations.size, 4, 'each relocated buff has a different safe')
})

test('authored apartment pistol stays depleted across failed pickups, refreshes, deposits and save/load', () => {
  const data = content()
  const seed = buildContainerSeeds(data.containers, data.items).find(seed => seed.id === 'smuggler-apartment-safe')
  assert.equal(seed.restock, false)
  const seeds = [{ ...seed, locked: false }]
  const inventory = new InventoryService(data.items, seeds, () => 0,
    ['hammer', 'wrench', 'oil', 'duct-tape', 'batteries', 'bread'].map(itemId => ({ itemId, quantity: 1 })))
  inventory.openContainer(seed.id)
  inventory.takeItem('service-pistol')
  assert.ok(inventory.getSnapshot().containers[seed.id].items.some(stack => stack.itemId === 'service-pistol'))
  inventory.removeItems([{ itemId: 'bread', quantity: 1 }])
  inventory.takeItem('service-pistol')
  inventory.takeItem('service-pistol')
  assert.equal(inventory.getSnapshot().items.filter(stack => stack.itemId === 'service-pistol').length, 1)
  inventory.storeItem('hammer')
  for (let i = 0; i < 3; i++) {
    inventory.refreshContainers('night')
    inventory.refreshContainers()
  }
  const restored = new InventoryService(data.items, seeds)
  restored.restoreState(inventory.saveState())
  restored.refreshContainers()
  restored.refreshContainers('night')
  const remaining = restored.getSnapshot().containers[seed.id].items
  assert.ok(!remaining.some(stack => stack.itemId === 'service-pistol'))
  assert.equal(remaining.find(stack => stack.itemId === 'hammer')?.quantity, 1)
})

test('authored permanent buffs have finite or legendary vendor routes and every district has two trashbins', () => {
  const data=content(), vendors=buildVendorSeeds(data.dialogues,data.items)
  const seeds=buildContainerSeeds(data.containers,data.items)
  const groups=[vendors,seeds.filter(s=>s.restock===false&&s.locked),seeds.filter(s=>s.restock===false&&!s.locked)]
  const buffs=data.items.filter(i=>i.randomLoot!==false&&!i.consumable&&(i.bonus||i.bonuses?.length||i.fearResistance||i.stealthModifier))
  for(const item of buffs) {
    const routes=groups.flatMap((group,n)=>group.some(s=>s.items.some(stack=>stack.itemId===item.id))?[n]:[])
    assert.ok(routes.length >= 1 || item.saleable !== false, item.id)
  }
  for(const loc of data.locations) assert.equal(data.containers.placements.filter(p=>p.locationId===loc.id&&p.type==='trash').length,2)
})
