import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { buildVendorSeeds } from '../../src/app/content/vendorSeeds.ts'
import { refreshContainersEachMorning } from '../../src/app/services/refreshContainersEachMorning.ts'
import { detectsHero } from '../../src/domain/combat/patrolCombat.ts'
import { activeQuestStages } from '../../src/domain/quests/quests.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

function setup(start = []) {
  const data=content(),time=new DayTime()
  let quests
  const seeds=[...buildContainerSeeds(data.containers,data.items),...buildVendorSeeds(data.dialogues,data.items)]
  const inventory=new InventoryService(data.items,seeds,()=>0,start,undefined,undefined,undefined,undefined,()=>99,false,
    id=>{const seed=seeds.find(s=>s.id===id);return (!seed.nightOnly||time.getSnapshot().phase==='night')&&(!seed.questId||quests.isActive(seed.questId))&&(!seed.questIds||seed.questIds.some(id=>quests.isActive(id)))},undefined,undefined,undefined,undefined,(id,itemId)=>quests.canTakeDeliveryItem(id,itemId))
  quests=new QuestService(data.quests,inventory,undefined,time,()=>0)
  refreshContainersEachMorning(time,inventory)
  const finished=n=>data.quests.filter(q=>/^cashier-[1-5]$/.test(q.id)&&Number(q.id.slice(-1))<=n).map(q=>({questId:q.id,stageIndex:q.stages.length}))
  const act=(id,i)=>{const t=data.quests.find(q=>q.id===id).stages[i].trigger;return quests.advanceDialogue(id,t.npcId,t.choiceId)}
  const retry=id=>{const t=data.quests.find(q=>q.id===id).retryTrigger;return quests.advanceDialogue(id,t.npcId,t.choiceId)}
  const progress=id=>quests.getSnapshot().progress.find(p=>p.questId===id)
  return {data,time,inventory,quests,finished,act,retry,progress}
}

test('acceptance grants regular goods automatically and pays only after deliveries and return',()=>{
  const {data,inventory,quests,act}=setup()
  for(let n=1;n<=4;n++){
    const id='cashier-'+n,q=data.quests.find(q=>q.id===id)
    assert.equal(quests.acceptFromNpc(id,'cashier'),true)
    assert.equal(quests.acceptFromNpc(id,'cashier'),false)
    assert.equal(act(id,0),false)
    for(const s of q.stages[0].grantItems){assert.notEqual(data.items.find(i=>i.id===s.itemId).saleable,false);assert.ok(inventory.getSnapshot().items.some(i=>i.itemId===s.itemId))}
    const money=inventory.getSnapshot().money
    for(let i=1;i<q.stages.length-1;i++)assert.equal(act(id,i),true)
    assert.equal(inventory.getSnapshot().money,money)
    assert.equal(act(id,q.stages.length-1),true);assert.equal(act(id,q.stages.length-1),false)
    assert.equal(inventory.getSnapshot().money,money+q.reward.money)
  }
  for(const id of ['flat-cap','canvas-backpack','work-pass'])assert.ok([...inventory.getSnapshot().items,...inventory.getEquippedItems()].some(i=>i.itemId===id))
})

test('full inventory rejects acceptance atomically, and failed rewards remain retryable',()=>{
  const start=['rope','wrench','pliers','cloth','work-pass','sealed-envelope'].map(itemId=>({itemId,quantity:1}))
  const {inventory,quests,act}=setup(start),before=inventory.getSnapshot()
  assert.equal(quests.acceptFromNpc('cashier-1','cashier'),false)
  assert.equal(inventory.getSnapshot(),before);assert.equal(quests.isActive('cashier-1'),false)
  inventory.removeItems([{itemId:'rope',quantity:1}]);assert.equal(quests.acceptFromNpc('cashier-1','cashier'),true)
  assert.equal(act('cashier-1',1),true);inventory.grantItems([{itemId:'old-newspapers',quantity:1}])
  assert.equal(act('cashier-1',2),false);assert.equal(quests.isCompleted('cashier-1'),false)
  inventory.removeItems([{itemId:'old-newspapers',quantity:1}]);assert.equal(act('cashier-1',2),true)
})

test('saved deadlines expire after four phases and retry never grants replacement goods',()=>{
  const {inventory,quests,time,finished,act,retry,progress}=setup()
  quests.restoreState(finished(2));quests.acceptFromNpc('cashier-3','cashier')
  const saved=structuredClone(quests.getSnapshot())
  time.advance();time.advance();time.advance();quests.restoreState(saved.progress,saved.courierBoard,saved.npcJobs)
  assert.equal(progress('cashier-3').deadline,4);time.advance();assert.equal(progress('cashier-3').failed,true)
  assert.equal(act('cashier-3',1),false);inventory.removeItems([{itemId:'batteries',quantity:1}])
  assert.equal(retry('cashier-3'),true);assert.equal(retry('cashier-3'),false)
  assert.equal(inventory.getSnapshot().items.some(i=>i.itemId==='batteries'),false)
  inventory.grantItems([{itemId:'batteries',quantity:1}]);assert.equal(act('cashier-3',1),true);assert.equal(act('cashier-3',2),true)
})

for(const order of [[1,2],[2,1]])test('both delivery objectives are active, can finish in order '+order.join(',')+' and survive reload',()=>{
  const {data,inventory,quests,finished,act,progress}=setup()
  quests.restoreState(finished(3));assert.equal(quests.acceptFromNpc('cashier-4','cashier'),true)
  const q=data.quests.find(q=>q.id==='cashier-4')
  assert.deepEqual(activeQuestStages(q,progress(q.id)).map(s=>s.id),q.stages.slice(1,3).map(s=>s.id))
  for(const i of [1,2])assert.equal(quests.canAdvanceDialogue(q.id,q.stages[i].trigger.npcId,q.stages[i].trigger.choiceId),true)
  assert.equal(act(q.id,order[0]),true);assert.equal(act(q.id,order[0]),false)
  assert.equal(progress(q.id).stageIndex,1);assert.equal(act(q.id,3),false)
  const saved=structuredClone(quests.getSnapshot());quests.restoreState(saved.progress,saved.courierBoard,saved.npcJobs)
  assert.equal(activeQuestStages(q,progress(q.id)).length,1);assert.equal(act(q.id,order[0]),false)
  assert.equal(act(q.id,order[1]),true);assert.equal(progress(q.id).stageIndex,3)
  assert.equal(act(q.id,3),true);assert.equal(inventory.getSnapshot().money,q.reward.money)
})

test('parallel delivery timeout clears individual completions on restart without issuing goods',()=>{
  const {quests,time,finished,act,retry,progress}=setup()
  quests.restoreState(finished(3));quests.acceptFromNpc('cashier-4','cashier');act('cashier-4',2)
  time.nextMorning();assert.equal(progress('cashier-4').failed,true)
  assert.equal(retry('cashier-4'),true);assert.equal(progress('cashier-4').completedStageIds,undefined)
  assert.equal(act('cashier-4',2),false)
})

test('each district has one shared shipment crate and the last story job requires its requested pickup',()=>{
  const {inventory,quests,time,finished,act,progress}=setup()
  const data = content()
  for (const location of data.locations) {
    const crates = data.containers.placements.filter(p => p.locationId === location.id && p.type === 'smuggler-crate')
    assert.equal(crates.length, 1, location.id)
    assert.equal(crates[0].restock,false)

  }
  quests.restoreState(finished(4));assert.equal(quests.acceptFromNpc('cashier-5','cashier'),true)
  assert.equal(progress('cashier-5').stageIndex,1)
  inventory.openContainer('cashier-5-crate');const daytime=inventory.getSnapshot();inventory.takeItem('bandage');assert.equal(inventory.getSnapshot(),daytime)
  inventory.grantItems([{itemId:'bandage',quantity:1}]);assert.equal(act('cashier-5',2),false)
  for(let i=0;i<3;i++)time.advance()
  inventory.openContainer('cashier-5-crate');inventory.takeItem('beer-bottle')
  assert.equal(progress('cashier-5').stageIndex,1)
  inventory.takeItem('bandage');inventory.closeMenu();assert.equal(progress('cashier-5').stageIndex,2)
  assert.equal(act('cashier-5',2),false)
  time.advance();assert.equal(act('cashier-5',2),true);assert.equal(act('cashier-5',3),true)
})

test('missing the morning deadline fails night delivery and restarts directly at collection',()=>{
  const {inventory,quests,time,finished,act,retry,progress}=setup()
  quests.restoreState(finished(4));quests.acceptFromNpc('cashier-5','cashier')
  for(let i=0;i<3;i++)time.advance()
  inventory.openContainer('cashier-5-crate');inventory.takeItem('bandage');inventory.closeMenu()
  time.advance();time.advance();assert.equal(progress('cashier-5').failed,true);assert.equal(act('cashier-5',2),false)
  assert.equal(retry('cashier-5'),true);assert.equal(progress('cashier-5').stageIndex,1)
})

test('the cashier chain unlocks no per-route radiant definitions; the board reuses one courier template',()=>{
 const {data,quests,time,finished}=setup()
 quests.restoreState(finished(5))
 assert.equal(data.quests.some(q=>q.id.startsWith('night-courier-')),false)
 for(let run=0;run<2;run++){
  if(run)time.nextMorning()
  const q=quests.getBoardQuests().find(q=>q.deliveryKind==='courier')
  assert.equal(q.id,'courier-delivery');quests.openBoard();quests.accept(q.id)
  assert.equal(quests.advanceDialogue(q.id,q.stages[0].trigger.npcId,'courier-pickup'),true)
  assert.equal(quests.advanceDialogue(q.id,q.stages[1].trigger.npcId,'courier-deliver'),true)
 }
})

test('replacement shop and collection replies are removed; Journal uses J',()=>{
  const data=content(),cashier=data.dialogues.cashier
  assert.ok(!cashier.barters?.some(b=>b.id==='merchant:cashier-deliveries'))
  const choices=Object.values(cashier.nodes).flatMap(n=>n.choices)
  assert.ok(!choices.some(c=>c.id==='delivery-supplies'||c.id.match(/^cashier-\d-collect$/)))
  assert.deepEqual(data.ui.menus.find(m=>m.id==='quests'),{id:'quests',title:'Journal',key:'j',emptyMessage:'No quests available.'})
  validateContent(data)
})

test('pass suppresses routine patrol detection but never monsters, combat, or hidden-target rules',()=>{
  const source={x:0,y:0},target={x:1,y:0,available:true,patrolPass:true}
  assert.equal(detectsHero(source,target,10,true),false)
  assert.equal(detectsHero(source,{...target,patrolPass:false},10,true),true)
  assert.equal(detectsHero(source,target,10,true,true),true)
  assert.equal(detectsHero(source,target,10,true,false,true),true)
  assert.equal(detectsHero(source,{...target,available:false},10,true,true,true),false)
})
