import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { normalizeStacks } from '../../src/domain/inventory/loot.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
const stack=(itemId,quantity=1)=>({itemId,quantity})
const bottles=['kvass-bottle','water-bottle']
const alcohol=['beer-bottle','canned-beer','cider','spirits','vodka','whiskey','wine']

test('alcohol stacks to three, other bottles one, ammunition six, cigarettes ten, medicines five',()=>{
 const {items}=content();const byId=Object.fromEntries(items.map(i=>[i.id,i]));const limit=id=>byId[id].maxStack??1
 for(const id of [...bottles,'oil','flask'])assert.equal(limit(id),1,id)
 for(const id of alcohol)assert.equal(limit(id),3,id)
 for(const id of ['antiseptic','antiseptic-bottle','medicine-bottle'])assert.equal(limit(id),5,id)
 for(const item of items.filter(i=>i.ammunition))assert.equal(item.maxStack,6,item.id)
 for(const id of ['red-cigarettes','grey-cigarettes'])assert.equal(limit(id),10,id)
 assert.deepEqual(normalizeStacks([stack('vodka',4)],limit),[stack('vodka',3),stack('vodka')])
 assert.deepEqual(normalizeStacks([stack('pistol-ammunition',7)],limit),[stack('pistol-ammunition',6),stack('pistol-ammunition')])
 assert.deepEqual(normalizeStacks([stack('red-cigarettes',11)],limit),[stack('red-cigarettes',10),stack('red-cigarettes')])
})
test('partial ammunition pickups stop at six in a full inventory and preserve overflow',()=>{
 const {items}=content();const inventory=new InventoryService(items,[{id:'stash',name:'Stash',locationId:'test',items:[stack('pistol-ammunition',2),stack('vodka')]}],()=>0,[stack('pistol-ammunition',5),...['rope','cloth','wrench','pliers','letter'].map(id=>stack(id))])
 inventory.openContainer('stash');inventory.takeItem('pistol-ammunition',0)
 assert.equal(inventory.getSnapshot().items[0].quantity,6)
 assert.deepEqual(inventory.getSnapshot().containers.stash.items,[stack('pistol-ammunition'),stack('vodka')])
 const before=inventory.getSnapshot();inventory.takeAll();assert.equal(inventory.getSnapshot(),before)
})
test('cigarette pickups fill ten and split overflow into the next slot',()=>{
 const inventory=new InventoryService(content().items,[{id:'stash',name:'Stash',locationId:'test',items:[stack('red-cigarettes',3)]}],()=>0,[stack('red-cigarettes',9)])
 inventory.openContainer('stash');inventory.takeItem('red-cigarettes',0)
 assert.deepEqual(inventory.getSnapshot().items,[stack('red-cigarettes',10),stack('red-cigarettes',2)])
})
test('content permits ammunition and cigarette limits while keeping other consumables capped at five',()=>{
 for(const [id,limit] of [['pistol-ammunition',7],['red-cigarettes',11],['medicine-bottle',6]]){
  const {data,sources}=catalogue();data.items.find(i=>i.id===id).maxStack=limit
  assert.throws(()=>validateContent(data,sources),/maxStack/)
 }
})
test('restoring old bottle stacks preserves quantity and indexed partial ammunition stacks',()=>{
 const inventory=new InventoryService(content().items,[{id:'stash',name:'Stash',locationId:'test',items:[]}],()=>0)
 const saved=inventory.saveState();saved.items=[stack('vodka',3),stack('pistol-ammunition',5),stack('pistol-ammunition'),stack('red-cigarettes',10)];saved.containers.stash.items=[stack('beer-bottle',5)]
 inventory.restoreState(saved)
 assert.deepEqual(inventory.getSnapshot().items,[stack('vodka',3),stack('pistol-ammunition',5),stack('pistol-ammunition'),stack('red-cigarettes',10)])
 assert.deepEqual(inventory.getSnapshot().containers.stash.items,[stack('beer-bottle',3),stack('beer-bottle',2)])
 const before=inventory.getSnapshot();saved.items.push(stack('letter'),stack('rope'),stack('cloth'))
 assert.throws(()=>inventory.restoreState(saved),/capacity/);assert.equal(inventory.getSnapshot(),before)
})
test('spent shotgun shells are single-slot scrap, not ammunition, and scrapping spends exactly the selected shell',()=>{
 const data=content(),shell=data.items.find(item=>item.id==='shotgun-shells')
 assert.equal(shell.scrap,true);assert.equal(shell.ammunition,undefined);assert.equal(shell.maxStack,1)
 assert.equal(data.skills.scrapping.rewards.some(item=>item.itemId===shell.id),false)
 const inventory=new InventoryService(data.items,[],()=>1,[stack(shell.id),stack(shell.id),stack('pistol-ammunition',6)],undefined,undefined,undefined,undefined,()=>20)
 inventory.openInventory();inventory.useItem(1)
 assert.deepEqual(inventory.getSnapshot().items,[stack(shell.id),stack('pistol-ammunition',6)])
})
