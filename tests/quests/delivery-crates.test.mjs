import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { refreshContainersEachMorning } from '../../src/app/services/refreshContainersEachMorning.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
const stack=(itemId,quantity=1)=>({itemId,quantity})
const fillers=['old-newspapers','wrench','pliers','cloth','letter','postcard'].map(id=>stack(id))
function setup(start=[],roll=0){
 const data=content(),time=new DayTime(),messages=[];let quests
 const inventory=new InventoryService(data.items,buildContainerSeeds(data.containers,data.items),()=>0,start,undefined,undefined,undefined,text=>messages.push(text),()=>20,false,()=>true,()=>10,()=>({weapons:10,medicine:10}),undefined,undefined,(id,itemId)=>quests.canTakeDeliveryItem(id,itemId))
 quests=new QuestService(data.quests,inventory,text=>messages.push(text),time,()=>roll)
 refreshContainersEachMorning(time,inventory)
 const finished=[1,2,3,4].map(n=>({questId:`smuggler-${n}`,stageIndex:data.quests.find(q=>q.id===`smuggler-${n}`).stages.length}))
 const unlock=()=>quests.restoreState(finished)
 const accept=()=>{const id=quests.getSnapshot().npcJobs.offeredQuestIds[0];assert.equal(quests.acceptFromNpc(id,'citizen-mechanic'),true);return quests.definitions.find(q=>q.id===id)}
 const night=()=>{while(time.getSnapshot().phase!=='night')time.advance()}
 return {data,time,inventory,quests,messages,unlock,accept,night}
}
test('one generic smuggler template uses two shared delivery items and exactly one crate in each location',()=>{
 const {data}=setup(),routes=data.quests.filter(q=>q.id==='smuggler-delivery')
 assert.equal(routes.length,1);assert.equal(routes[0].destinations.length,3)
 const crates=data.containers.placements.filter(c=>c.type==='smuggler-crate')
 assert.equal(crates.length,data.locations.length)
 for(const location of data.locations)assert.equal(crates.filter(c=>c.locationId===location.id).length,1)
 assert.deepEqual(data.items.filter(i=>/parcel$/.test(i.id)).map(i=>i.id).sort(),['courier-parcel','smuggler-parcel'])
 assert.equal(data.items.find(i=>i.id==='shotgun-shells').scrap,true)
 assert.equal(data.items.find(i=>i.id==='shotgun-shells').ammunition,undefined)
 for(const route of routes){assert.equal(route.stages[0].trigger.containerId,'$source');assert.equal(route.stages[1].trigger.containerId,'$destination');assert.equal(route.stages[2].trigger.npcId,'citizen-mechanic')}
})
test('smuggler pickup is night-only, wrong deposits do not count, and Dusan pays only after the destination deposit',()=>{
 for(const roll of [0,0.2,0.4,0.6,0.8,0.999]){
  const {data,inventory,quests,unlock,accept,night}=setup([],roll);unlock();const route=accept(),[collect,deposit,report]=route.stages
  const progress=()=>quests.getSnapshot().progress.find(p=>p.questId===route.id)
  assert.equal(quests.getOffer('worker'),data.quests.find(q => q.id === 'mechanic-scrap').offerText)
  inventory.openContainer(collect.trigger.containerId);const before=inventory.getSnapshot();inventory.takeItem('smuggler-parcel')
  assert.equal(inventory.getSnapshot(),before);assert.equal(progress().stageIndex,0)
  assert.equal(quests.advanceDialogue(route.id,'citizen-mechanic',report.trigger.choiceId),false)
  night();inventory.takeItem('smuggler-parcel');assert.equal(progress().stageIndex,1)
  const wrong=data.containers.placements.find(c=>c.type==='smuggler-crate'&&c.id!==deposit.trigger.containerId).id
  inventory.openContainer(wrong);inventory.storeItem('smuggler-parcel');assert.equal(progress().stageIndex,1)
  inventory.takeItem('smuggler-parcel');assert.equal(progress().stageIndex,1)
  inventory.openContainer(deposit.trigger.containerId);inventory.storeItem('smuggler-parcel');assert.equal(progress().stageIndex,2)
  assert.equal(inventory.getSnapshot().money,0);assert.equal(quests.isCompleted(route.id),false)
  assert.equal(Object.values(inventory.getSnapshot().containers).some(c=>c.items.some(i=>i.itemId==='smuggler-parcel')),false)
  assert.equal(quests.advanceDialogue(route.id,'worker',report.trigger.choiceId),false)
  assert.equal(quests.advanceDialogue(route.id,'citizen-mechanic',report.trigger.choiceId),true)
  assert.equal(inventory.getSnapshot().money,route.reward.money);assert.equal(quests.isCompleted(route.id),true)
  assert.equal(quests.advanceDialogue(route.id,'citizen-mechanic',report.trigger.choiceId),false)
 }
})
test('failed pickups and full-inventory payment preserve progress and pay once after making room',()=>{
 const {inventory,quests,unlock,accept,night}=setup(fillers);unlock();const route=accept();night()
 inventory.openContainer(route.stages[0].trigger.containerId);inventory.takeItem('smuggler-parcel')
 assert.equal(quests.getSnapshot().progress.find(p=>p.questId===route.id).stageIndex,0)
 inventory.removeItems([fillers[0]]);inventory.takeItem('smuggler-parcel')
 inventory.openContainer(route.stages[1].trigger.containerId);inventory.storeItem('smuggler-parcel')
 inventory.grantItems([fillers[0]])
 const report=()=>quests.advanceDialogue(route.id,'citizen-mechanic',route.stages[2].trigger.choiceId)
 const before=inventory.getSnapshot();assert.equal(report(),false);assert.equal(inventory.getSnapshot(),before)
 inventory.removeItems([fillers[0]]);assert.equal(report(),true);assert.equal(report(),false)
 assert.equal(inventory.getSnapshot().money,route.reward.money)
})
test('one active courier and one active smuggler can coexist but second jobs and multiple board offers are blocked',()=>{
 const {data,time,inventory,quests,unlock,accept,night}=setup();unlock();const smuggler=accept();night();inventory.openContainer(smuggler.stages[0].trigger.containerId);inventory.takeItem('smuggler-parcel')
 const board=()=>quests.getBoardQuests()
 assert.equal(board().filter(q=>q.deliveryKind==='courier').length,1)
 const id=quests.getSnapshot().courierBoard.offeredQuestIds[0];quests.openBoard();quests.accept(id)
 const courier=quests.definitions.find(q=>q.id===id),pickup=courier.stages[0]
 assert.equal(quests.advanceDialogue(id,pickup.trigger.npcId,pickup.trigger.choiceId),true)
 assert.ok(inventory.getSnapshot().items.some(i=>i.itemId==='courier-parcel'))
 assert.equal(board().filter(q=>q.deliveryKind==='courier').length,0)
 time.nextMorning();quests.openBoard();quests.accept(id);assert.equal(quests.getSnapshot().progress.filter(p=>p.questId===id).length,1)
 assert.equal(quests.isActive(smuggler.id),true);assert.equal(quests.isActive(id),true)
})
test('expiry removes shared parcels from inventory, all containers and deposit ledgers without deleting the other job item',()=>{
 const {time,inventory,quests,unlock,accept,night}=setup();unlock();const route=accept();night()
 inventory.openContainer(route.stages[0].trigger.containerId);inventory.takeItem('smuggler-parcel')
 const source=route.stages[0].trigger.containerId;inventory.openContainer(source);inventory.storeItem('smuggler-parcel')
 inventory.grantItems([stack('courier-parcel')])
 for(let i=0;i<4;i++)time.advance()
 assert.equal(quests.getSnapshot().progress.find(p=>p.questId===route.id).failed,true)
 assert.equal(quests.isActive(route.id),false)
 assert.equal(inventory.getSnapshot().items.some(i=>i.itemId==='courier-parcel'),true)
 assert.equal(Object.values(inventory.getSnapshot().containers).some(c=>c.items.some(i=>i.itemId==='smuggler-parcel')),false)
 assert.equal(Object.values(inventory.saveState().deposits).some(items=>items.some(i=>i.itemId==='smuggler-parcel')),false)
})
test('reload preserves a collected smuggler parcel and never completes a deposit from pre-existing stored items',()=>{
 const {inventory,quests,unlock,accept,night}=setup();unlock();const route=accept();night()
 inventory.openContainer(route.stages[0].trigger.containerId);inventory.takeItem('smuggler-parcel')
 const progress=structuredClone(quests.getSnapshot()),saved=inventory.saveState()
 inventory.restoreState(saved);quests.restoreState(progress.progress,progress.courierBoard,progress.npcJobs)
 assert.equal(inventory.getSnapshot().items.filter(i=>i.itemId==='smuggler-parcel').length,1)
 assert.equal(quests.getSnapshot().progress.find(p=>p.questId===route.id).stageIndex,1)
 inventory.openContainer(route.stages[1].trigger.containerId);inventory.storeItem('smuggler-parcel')
 assert.equal(quests.getSnapshot().progress.find(p=>p.questId===route.id).stageIndex,2)
})
test('deposit container references and required shared items are validated',()=>{
 for(const patch of [q=>{q.stages[1].trigger.containerId='missing'},q=>{delete q.stages[1].requiredItems},q=>{q.deliveryItemId='rope'}]){
  const {data,sources}=catalogue();patch(data.quests.find(q=>q.id==='smuggler-delivery'))
  assert.throws(()=>validateContent(data,sources))
 }
})
test('swapping a parcel into the designated crate counts as a deposit but does not pay until return',()=>{
 const {inventory,quests,unlock,accept,night}=setup();unlock();const route=accept();night()
 inventory.openContainer(route.stages[0].trigger.containerId);inventory.takeItem('smuggler-parcel')
 inventory.grantItems([stack('cloth')]);inventory.openContainer(route.stages[1].trigger.containerId);inventory.storeItem('cloth')
 inventory.swapItems('smuggler-parcel','cloth')
 assert.equal(quests.getSnapshot().progress.find(p=>p.questId===route.id).stageIndex,2)
 assert.equal(inventory.getSnapshot().money,0)
 assert.deepEqual(inventory.getSnapshot().items,[stack('cloth')])
 assert.equal(quests.advanceDialogue(route.id,'citizen-mechanic',route.stages[2].trigger.choiceId),true)
 assert.equal(inventory.getSnapshot().money,route.reward.money)
})
