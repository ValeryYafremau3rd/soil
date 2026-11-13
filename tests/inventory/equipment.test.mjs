import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { EQUIPMENT_SLOTS, applyCarriedBonuses } from '../../src/domain/inventory/items.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { content } from '../helpers/content.mjs'
import classes from '../../src/content/classes.json' with { type: 'json' }
const definitions = [{id:'hammer',equipmentSlot:'tool',bonus:{skill:'scraper',amount:2}},{id:'wrench',equipmentSlot:'tool'}, {id:'bag',equipmentSlot:'bag',inventorySlots:3}, {id:'gun',equipmentSlot:'ranged',firearm:{ammunitionId:'ammo'}}, {id:'ammo',ammunition:true,maxStack:5}]
const stack = itemId => ({itemId,quantity:1})
test('equipment swaps atomically, unequips, and round trips saves',()=>{
 const inventory=new InventoryService(definitions,[],()=>0,['hammer','wrench'].map(stack))
 inventory.openInventory();inventory.useItem(0)
 assert.deepEqual(inventory.getSnapshot().equipment,{tool:'hammer'})
 assert.deepEqual(inventory.getSnapshot().items,[stack('wrench')])
 inventory.useItem(0)
 assert.deepEqual(inventory.getSnapshot().equipment,{tool:'wrench'})
 assert.deepEqual(inventory.getSnapshot().items,[stack('hammer')])
 const saved=inventory.saveState();inventory.unequip('tool');inventory.unequip('tool')
 assert.equal(inventory.getSnapshot().items.length,2)
 inventory.restoreState(saved);assert.equal(inventory.getSnapshot().equipment.tool,'wrench')
})
test('full inventory blocks bag unequip without loss',()=>{
 const inventory=new InventoryService([...definitions,...Array.from({length:8},(_,i)=>({id:`f${i}`}))],[],()=>0,[stack('bag')])
 assert.equal(inventory.getCapacity(),6)
 inventory.openInventory();inventory.useItem(0);assert.equal(inventory.getCapacity(),9)
 inventory.grantItems(Array.from({length:8},(_,i)=>stack(`f${i}`)))
 const before=inventory.getSnapshot();inventory.unequip('bag');assert.equal(inventory.getSnapshot(),before)
 inventory.removeItems(['f0','f1','f2'].map(stack));inventory.unequip('bag')
 assert.equal(inventory.getCapacity(),6);assert.equal(inventory.getSnapshot().equipment.bag,undefined)
 assert.equal(inventory.getSnapshot().items.length,6)
})

test('carried gun requires equipping and shots consume only ammunition',()=>{
 const inventory=new InventoryService(definitions,[],()=>0,['gun','ammo'].map(stack))
 assert.equal(inventory.canShoot(),false)
 inventory.openInventory();inventory.useItem(0);inventory.closeMenu()
 assert.equal(inventory.tryShoot(),true);assert.deepEqual(inventory.getSnapshot().equipment,{ranged:'gun'})
 assert.equal(inventory.getSnapshot().items.length,0);assert.equal(inventory.tryShoot(),false)
})
test('only the equipment list contributes passive bonuses',()=>{
 const character=createCharacter(classes[0]);const byId=Object.fromEntries(definitions.map(d=>[d.id,d]))
 const inventory=new InventoryService(definitions,[],()=>0,[stack('hammer')]);const base=applyCarriedBonuses(character,inventory.getEquippedItems(),byId)
 inventory.openInventory();inventory.useItem(0)
 assert.equal(applyCarriedBonuses(character,inventory.getEquippedItems(),byId).skills.scraper,base.skills.scraper+2)
 inventory.unequip('tool');assert.equal(applyCarriedBonuses(character,inventory.getEquippedItems(),byId).skills.scraper,base.skills.scraper)
})
test('unmet requirements and invalid selections preserve items; invalid saved slots are rejected',()=>{
 const inventory=new InventoryService([{id:'locked',equipmentSlot:'armor',eruditionRequired:10}],[],()=>0,[stack('locked')])
 inventory.openInventory();const before=inventory.getSnapshot()
 for(const slot of [0,-1,0.5,NaN,10])inventory.useItem(slot)
 assert.equal(inventory.getSnapshot(),before)
 const saved=inventory.saveState();saved.equipment={tool:'locked'}
 assert.throws(()=>inventory.restoreState(saved),/Invalid saved equipment/)
 assert.equal(inventory.getSnapshot(),before)
})

test('carried magazines apply once per type alongside equipped gear and stop on removal',()=>{
 const data=content();const byId=Object.fromEntries(data.items.map(item=>[item.id,item]));const character=createCharacter(classes[0])
 const id='stealth-training-magazine';assert.equal(byId[id].equipmentSlot,undefined)
 const inventory=new InventoryService(data.items,[],()=>0,[stack(id),stack(id),stack('hammer')],undefined,undefined,undefined,undefined,()=>20)
 const effective=()=>applyCarriedBonuses(character,inventory.getBonusItems(),byId)
 const base=applyCarriedBonuses(character,[],byId)
 assert.equal(effective().skills.stealth,base.skills.stealth+byId[id].bonus.amount)
 assert.equal(effective().skills.scraper,base.skills.scraper)
 inventory.openInventory();inventory.useItem(2)
 assert.equal(effective().skills.scraper,base.skills.scraper+byId.hammer.bonus.amount)
 const before=inventory.getSnapshot();inventory.useItem(0);assert.equal(inventory.getSnapshot(),before)
 inventory.removeItems([{itemId:id,quantity:2}]);assert.equal(effective().skills.stealth,base.skills.stealth)
 inventory.unequip('tool');assert.equal(effective().skills.scraper,base.skills.scraper)
})
test('previously equipped magazines return to inventory when restoring a save',()=>{
 const data=content();const inventory=new InventoryService(data.items,[],()=>0)
 const saved=inventory.saveState();saved.equipment={tool:'stealth-training-magazine'}
 inventory.restoreState(saved)
 assert.deepEqual(inventory.getSnapshot().equipment,{})
 assert.deepEqual(inventory.getSnapshot().items,[stack('stealth-training-magazine')])
 assert.deepEqual(saved.equipment,{tool:'stealth-training-magazine'})
})
test('shoes follow armor and socks swap with footwear without replacing body armor',()=>{
 const data=content();const inventory=new InventoryService(data.items,[],()=>0,['work-jacket','leather-boots','wool-socks'].map(stack),undefined,undefined,undefined,undefined,()=>20)
 assert.equal(EQUIPMENT_SLOTS[EQUIPMENT_SLOTS.indexOf('armor')+1],'shoes')
 inventory.openInventory();inventory.useItem(0);inventory.useItem(0)
 assert.deepEqual(inventory.getSnapshot().equipment,{armor:'work-jacket',shoes:'leather-boots'})
 inventory.useItem(0)
 assert.deepEqual(inventory.getSnapshot().equipment,{armor:'work-jacket',shoes:'wool-socks'})
 assert.deepEqual(inventory.getSnapshot().items,[stack('leather-boots')])
 const saved=inventory.saveState();inventory.unequip('shoes');inventory.unequip('shoes')
 assert.equal(inventory.getSnapshot().equipment.armor,'work-jacket')
 assert.equal(inventory.getSnapshot().items.length,2)
 inventory.restoreState(saved);assert.equal(inventory.getSnapshot().equipment.shoes,'wool-socks')
 assert.equal(data.items.find(item=>item.id==='trainers').equipmentSlot,'shoes')
})
test('footwear in the old armor slot migrates into shoes without returning it to inventory',()=>{
 const inventory=new InventoryService(content().items,[],()=>0)
 const saved=inventory.saveState();saved.equipment={armor:'leather-boots'}
 inventory.restoreState(saved)
 assert.deepEqual(inventory.getSnapshot().equipment,{shoes:'leather-boots'})
 assert.deepEqual(inventory.getSnapshot().items,[])
 assert.deepEqual(saved.equipment,{armor:'leather-boots'})
})
test('equipped melee and ranged weapons use authored damage multipliers of at least one',()=>{
 const data=content();const inventory=new InventoryService(data.items,[],()=>0,['knife','compact-pistol','pistol-ammunition'].map(stack),undefined,undefined,undefined,undefined,()=>20,false,undefined,undefined,()=>({weapons:10,martialArts:10}))
 inventory.openInventory();inventory.useItem(0);inventory.useItem(0);inventory.closeMenu()
 assert.equal(inventory.getWeaponDamageMultiplier('melee'),1)
 assert.equal(inventory.getWeaponDamageMultiplier('shot'),data.items.find(item=>item.id==='compact-pistol').damageMultiplier)
 assert.ok(inventory.getWeaponDamageMultiplier('shot')>=1)
 assert.equal(inventory.canShoot(),true)
})
