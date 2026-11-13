import assert from 'node:assert/strict'
import test from 'node:test'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'
import { PerksService } from '../../src/app/services/PerksService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { buildVendorSeeds, vendorItemPool } from '../../src/app/content/vendorSeeds.ts'
import { resolveSkillEffects } from '../../src/domain/skills/effects.ts'
import { itemHasStats } from '../../src/domain/inventory/items.ts'
import { content } from '../helpers/content.mjs'
const data=content(),id='merchant:worker-basic',stack=(itemId,quantity=1)=>({itemId,quantity})
const quantity=(inventory,itemId)=>inventory.getSnapshot().containers[id].items.filter(i=>i.itemId===itemId).reduce((sum,i)=>sum+i.quantity,0)

test('ordinary vendors never generate pistol ammunition, including morning refreshes',()=>{
 const seeds=buildVendorSeeds(data.dialogues,data.items)
 assert.ok(seeds.every(seed=>!seed.items?.some(item=>item.itemId==='pistol-ammunition')&&!seed.loot?.itemIds.includes('pistol-ammunition')))
 assert.ok(!vendorItemPool({categories:[...new Set(data.items.map(item=>item.category))]},data.items).includes('pistol-ammunition'))
 const inventory=new InventoryService(data.items,seeds,()=>0)
 for(const phase of ['morning','night','morning']){
  inventory.refreshContainers(phase)
  assert.ok(Object.values(inventory.getSnapshot().containers).every(container=>!container.items.some(item=>item.itemId==='pistol-ammunition')))
 }
})

test('legacy ordinary vendor bullets become gated without losing player deposits or refilling a spent legendary stock',()=>{
 let skill=14
 const make=()=>new InventoryService(data.items,buildVendorSeeds(data.dialogues,data.items),()=>0,[],undefined,undefined,undefined,undefined,()=>20,false,undefined,undefined,()=>({barter:skill}))
 const old=make().saveState()
 delete old.barterAmmoVersion
 old.containers[id].items.push(stack('pistol-ammunition',5))
 old.deposits[id]=[stack('pistol-ammunition',1)]
 old.legendaryBarterStock={visible:true,items:[]}
 const inventory=make();inventory.restoreState(old);inventory.syncLegendaryStock()
 assert.equal(quantity(inventory,'pistol-ammunition'),1)
 skill=15;inventory.syncLegendaryStock();assert.equal(quantity(inventory,'pistol-ammunition'),5)
 const saved=inventory.saveState(),restored=make()
 restored.restoreState(saved);restored.syncLegendaryStock()
 assert.equal(quantity(restored,'pistol-ammunition'),5)
 assert.equal(saved.barterAmmoVersion,1)
 const depleted=structuredClone(old)
 depleted.containers[id].items=[];depleted.deposits={}
 const empty=make();empty.restoreState(depleted);empty.syncLegendaryStock()
 assert.equal(quantity(empty,'pistol-ammunition'),0)
})
test('legendary Barter stock appears at 15, hides below 15, and never rerolls on toggles or reload',()=>{
 let skill=14,rolls=0
 const make=(random=()=>{rolls++;return 0})=>new InventoryService(data.items,buildVendorSeeds(data.dialogues,data.items),random,[],undefined,undefined,undefined,undefined,()=>20,false,undefined,undefined,()=>({barter:skill}))
 const inventory=make();inventory.grantItems([stack('money',100)])
 inventory.openContainer(id);assert.equal(quantity(inventory,'pistol-ammunition'),0);assert.equal(quantity(inventory,'lockpick'),3)
 skill=15;inventory.syncLegendaryStock();assert.equal(quantity(inventory,'pistol-ammunition'),6)
 const stat=inventory.getSnapshot().containers[id].items.find(i=>itemHasStats(data.items.find(d=>d.id===i.itemId)))
 assert.ok(stat)
 assert.equal(inventory.saveState().legendaryBarterStock.items.filter(i=>!data.items.find(d=>d.id===i.itemId).ammunition).length,3)
 const rolled=rolls
 inventory.takeItem('pistol-ammunition');assert.equal(quantity(inventory,'pistol-ammunition'),5)
 skill=14;inventory.syncLegendaryStock();assert.equal(quantity(inventory,'pistol-ammunition'),0);assert.equal(quantity(inventory,stat.itemId),0)
 skill=15;inventory.syncLegendaryStock();assert.equal(quantity(inventory,'pistol-ammunition'),5);assert.equal(rolls,rolled)
 const saved=inventory.saveState(),restored=make(),beforeRestore=rolls
 restored.restoreState(saved);restored.openContainer(id);assert.equal(quantity(restored,'pistol-ammunition'),5)
 assert.deepEqual(restored.saveState().legendaryBarterStock,saved.legendaryBarterStock)
 assert.equal(rolls,beforeRestore,'restoring and opening must not reroll legendary stock')
})
test('legendary vendor purchases remain sold out; player-sold goods survive perk loss and normal daily refresh',()=>{
 let skill=15
 const inventory=new InventoryService(data.items,buildVendorSeeds(data.dialogues,data.items),()=>0,[stack('money',100)],undefined,undefined,undefined,undefined,()=>20,false,undefined,undefined,()=>({barter:skill}))
 inventory.openContainer(id)
 for(let i=0;i<6;i++)inventory.takeItem('pistol-ammunition')
 assert.equal(quantity(inventory,'pistol-ammunition'),0)
 inventory.storeItem('pistol-ammunition',inventory.getSnapshot().items.findIndex(i=>i.itemId==='pistol-ammunition'))
 assert.equal(quantity(inventory,'pistol-ammunition'),1)
 skill=14;inventory.syncLegendaryStock();assert.equal(quantity(inventory,'pistol-ammunition'),1)
 skill=15;inventory.syncLegendaryStock();assert.equal(quantity(inventory,'pistol-ammunition'),1)
 inventory.refreshContainers('morning');assert.equal(quantity(inventory,'pistol-ammunition'),6,'vendor ammo replenishes to its stack limit while retaining the player deposit')
})
test('every sellable stat item can roll, with unique daily choices and no quest items',()=>{
 const eligible=data.items.filter(item=>itemHasStats(item)&&item.saleable!==false&&!item.ammunition&&!item.attachToKeyRing)
 for(const target of eligible){
  let draws=0
  const inventory=new InventoryService(data.items,buildVendorSeeds(data.dialogues,data.items),()=>0,[],undefined,undefined,undefined,undefined,()=>20,false,undefined,undefined,()=>({barter:15}))
  inventory.random=()=>draws++===1?(eligible.findIndex(item=>item.id===target.id)+0.5)/eligible.length:0
  inventory.openContainer(id)
  const stock=inventory.saveState().legendaryBarterStock.items.filter(item=>!data.items.find(definition=>definition.id===item.itemId).ammunition)
  assert.ok(stock.some(item=>item.itemId===target.id),target.id)
  assert.equal(new Set(stock.map(item=>item.itemId)).size,stock.length)
  assert.ok(stock.every(stack=>eligible.some(item=>item.id===stack.itemId)))
 }
})

test('morning rerolls stat stock, replenishes bullets and pins, preserves sold equipment, and night does not reroll',()=>{
 let roll=0,skill=15
 const inventory=new InventoryService(data.items,buildVendorSeeds(data.dialogues,data.items),()=>roll,[],undefined,undefined,undefined,undefined,()=>20,false,undefined,undefined,()=>({barter:skill}))
 inventory.openContainer(id)
 const first=inventory.saveState().legendaryBarterStock.items
 inventory.grantItems([stack('work-jacket')]);inventory.unequip('armor');inventory.storeItem('work-jacket',0)
 inventory.refreshContainers('night');assert.deepEqual(inventory.saveState().legendaryBarterStock.items,first)
 roll=0.999;inventory.refreshContainers('morning')
 const next=inventory.saveState().legendaryBarterStock.items
 assert.equal(next.filter(item=>!data.items.find(definition=>definition.id===item.itemId).ammunition).length,6);assert.notDeepEqual(next,first)
 assert.equal(quantity(inventory,'lockpick'),3);assert.equal(quantity(inventory,'pistol-ammunition'),6)
 assert.equal(quantity(inventory,'work-jacket'),1)
 skill=14;inventory.syncLegendaryStock();assert.equal(quantity(inventory,'work-jacket'),1)
 inventory.refreshContainers('morning');assert.equal(quantity(inventory,'work-jacket'),1)
 assert.equal(quantity(inventory,'lockpick'),3);assert.equal(quantity(inventory,'pistol-ammunition'),0)
 assert.equal(inventory.saveState().legendaryBarterStock,undefined)
})

test('legendary scrap bullet quantities merge and split atomically without spending scrap when the result cannot fit',()=>{
 const rolls=[0.9,0.99]
 const inventory=new InventoryService(data.items,[],()=>rolls.shift()??0,[stack('shotgun-shells'),stack('pistol-ammunition',5),...['rope','wrench','pliers','cloth'].map(id=>stack(id))],undefined,undefined,undefined,undefined,()=>20,false,undefined,()=>15)
 inventory.openInventory();inventory.useItem(0)
 assert.deepEqual(inventory.getSnapshot().items.filter(i=>i.itemId==='pistol-ammunition').map(i=>i.quantity),[6,2])
 const smaller=data.items.map(item=>item.id==='pistol-ammunition'?{...item,maxStack:2}:item),blockedRolls=[0.9,0.99]
 const blocked=new InventoryService(smaller,[],()=>blockedRolls.shift()??0,[stack('shotgun-shells'),...['rope','wrench','pliers','cloth','letter'].map(id=>stack(id))],undefined,undefined,undefined,undefined,()=>20,false,undefined,()=>15)
 blocked.openInventory();const before=blocked.getSnapshot();blocked.useItem(0);assert.equal(blocked.getSnapshot(),before)
})
test('legendary scrap failures award bullets repeatedly while successful item recovery awards no bullets', () => {
 const rolls = [0.9, 0, 0.9, 0.4, 0, 0, 0]
 const messages = []
 let skill = 15
 const inventory = new InventoryService(data.items, [], () => rolls.shift() ?? 0,
  [stack('bent-nails'), stack('bent-nails'), stack('bent-nails'), stack('bent-nails')],
  undefined, undefined, undefined, message => messages.push(message), () => 20, false, undefined, () => skill)
 inventory.openInventory()
 const scrap = () => inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === 'bent-nails'))
 scrap(); scrap()
 assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'pistol-ammunition').quantity, 3)
 assert.match(messages.at(-1), /2 pistol ammunition/)
 scrap()
 assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'pistol-ammunition').quantity, 3)
 assert.ok(inventory.getSnapshot().items.some(item => item.itemId === 'screwdriver'))
 skill = 14
 rolls.push(0.99)
 scrap()
 assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'pistol-ammunition').quantity, 3)
 assert.match(messages.at(-1), /Nothing usable/)
})

test('Erudition item recovery and Medicine recovery each apply once and previews match actual healing',()=>{
 const time=new DayTime(),medicine=resolveSkillEffects({medicine:15},data.skills).recovery
 const status=new StatusService(undefined,()=>medicine),perks=new PerksService(data.ui.perks,time,status,undefined,undefined,data.ui.consumableBuffs,()=>1.5)
 status.setItemEffects(perks);status.restoreState({health:1,energy:100,sanity:100})
 const bandage=data.items.find(item=>item.id==='bandage'),expected=status.getRecovery(status.getItemRecovery(bandage.recovery,bandage.id)).health
 const inventory=new InventoryService(data.items,[],()=>0,[stack('bandage')],status,undefined,undefined,undefined,()=>20)
 inventory.useItem(0);assert.equal(status.getSnapshot().health,Math.min(100,1+expected))
 assert.equal(inventory.getSnapshot().items.length,0)
})
