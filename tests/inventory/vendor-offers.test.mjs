import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { buildVendorSeeds } from '../../src/app/content/vendorSeeds.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

test('Dusan offers non-weapon gear through home barter with bags split between vendors', () => {
  const data = content()
  const seeds = buildVendorSeeds(data.dialogues, data.items)
  const inventory = new InventoryService(data.items, seeds, () => 0)
  const dialogue = new DialogueService(inventory.openContainer)
  const home = data.npcs['citizen-mechanic'].schedule.night
  assert.equal(home.locationId, 'living-district')
  assert.equal(home.roomId, 'apartment-12')
  dialogue.openDialogue('Dusan', data.dialogues['citizen-mechanic'], 'citizen-mechanic')
  dialogue.chooseReply('smuggler-trade')
  assert.equal(inventory.getSnapshot().menu.containerId, 'merchant:worker-basic')
  const stock = inventory.getSnapshot().containers['merchant:worker-basic'].items
  const equipment = data.items.filter(item => item.saleable !== false
    && item.equipmentSlot && !['ranged', 'melee', 'bag'].includes(item.equipmentSlot)
    && item.category !== 'Weapon')
  for (const item of equipment) {
    assert.ok(stock.some(entry => entry.itemId === item.id), item.id)
  }
})

test('each bag has its own vendor and is guaranteed even when random offers fail', () => {
  const data = content()
  const seeds = buildVendorSeeds(data.dialogues, data.items)
  const owners = {
    briefcase: 'merchant:cashier',
    'canvas-backpack': 'merchant:citizen-nurse',
    'duffel-bag': 'merchant:worker-basic',
  }
  const bags = data.items.filter(item => item.equipmentSlot === 'bag')
  assert.deepEqual(bags.map(item => item.id).sort(), Object.keys(owners).sort())
  const inventory = new InventoryService(data.items, seeds, () => 0.999)
  for (const [itemId, vendorId] of Object.entries(owners)) {
    const vendors = seeds.filter(seed => seed.items.some(item => item.itemId === itemId)
      || seed.loot.offers.some(offer => offer.itemId === itemId))
    assert.deepEqual(vendors.map(vendor => vendor.id), [vendorId])
    assert.ok(inventory.getSnapshot().containers[vendorId].items
      .some(item => item.itemId === itemId), itemId)
  }
  inventory.refreshContainers()
  for (const [itemId, vendorId] of Object.entries(owners)) {
    assert.ok(inventory.getSnapshot().containers[vendorId].items
      .some(item => item.itemId === itemId), itemId)
  }
})

test('every ordinary tradable item has a vendor and chef gear belongs to the bartender', () => {
 const data=content(), seeds=buildVendorSeeds(data.dialogues,data.items)
 for(const item of data.items.filter(i=>i.saleable!==false&&i.category!=='Quest'&&i.category!=='Currency'&&i.id!=='pistol-ammunition'))
  assert.ok(seeds.some(s=>s.items.some(i=>i.itemId===item.id)||s.loot.offers.some(o=>o.itemId===item.id)),item.id)
 const bar=seeds.find(s=>s.id==='merchant:bartender')
 for(const id of ['chef-jacket','frying-pan'])assert.ok(bar.loot.offers.some(o=>o.itemId===id))
})

test('daily gear rolls preserve purchases until morning and preserve player sales across failed rolls', () => {
 const data=content(), seeds=buildVendorSeeds(data.dialogues,data.items)
 let roll=0
 const inventory=new InventoryService(data.items,seeds,()=>roll)
 inventory.grantItems([],100)
 inventory.openContainer('merchant:bartender')
 inventory.takeItem('chef-jacket')
 assert.ok(inventory.getSnapshot().items.some(i=>i.itemId==='chef-jacket'))
 inventory.closeMenu();inventory.refreshContainers('night')
 assert.ok(!inventory.getSnapshot().containers['merchant:bartender'].items.some(i=>i.itemId==='chef-jacket'))
 inventory.refreshContainers()
 assert.ok(inventory.getSnapshot().containers['merchant:bartender'].items.some(i=>i.itemId==='chef-jacket'))
 inventory.openContainer('merchant:bartender');inventory.takeItem('chef-jacket');inventory.storeItem('chef-jacket');inventory.closeMenu()
 roll=0.999;inventory.refreshContainers();inventory.refreshContainers()
 assert.equal(inventory.getSnapshot().containers['merchant:bartender'].items.filter(i=>i.itemId==='chef-jacket').length,1)
})
