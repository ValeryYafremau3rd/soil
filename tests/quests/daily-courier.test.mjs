import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
function setup(roll=0){const data=content(),time=new DayTimeService(),inventory=new InventoryService(data.items,[]),quests=new QuestService(data.quests,inventory,undefined,time,()=>roll);return {data,time,inventory,quests}}
test('the board offers one generic courier and one generic find request with stable parameters all day',()=>{
 for(const roll of [0,0.5,0.999]){
  const {quests,time}=setup(roll),before=structuredClone(quests.getSnapshot().courierBoard)
  assert.deepEqual(before.offeredQuestIds,['courier-delivery','find-item'])
  assert.ok(before.parameters['courier-delivery']);assert.ok(before.parameters['find-item'].itemId)
  for(let i=0;i<3;i++){quests.openBoard();quests.closeBoard();time.advance()}
  assert.deepEqual(quests.getSnapshot().courierBoard,before)
  assert.equal(quests.getBoardQuests().filter(q=>q.deliveryKind==='courier').length,1)
 }
})
test('current run parameters survive a new daily offer and saving/restoring cannot reroll or reissue parcels',()=>{
 const {quests,time,inventory}=setup(),offer=quests.getBoardQuests().find(q=>q.deliveryKind==='courier')
 time.advance();time.advance();time.advance();quests.openBoard();quests.accept(offer.id)
 quests.advanceDialogue(offer.id,offer.stages[0].trigger.npcId,'courier-pickup')
 const parameters=structuredClone(quests.getSnapshot().progress[0].parameters)
 time.nextMorning();assert.equal(quests.isActive(offer.id),true)
 assert.deepEqual(quests.getSnapshot().progress[0].parameters,parameters)
 assert.equal(quests.getBoardQuests().some(q=>q.deliveryKind==='courier'),false)
 const state=structuredClone(quests.getSnapshot()),restored=new QuestService(content().quests,inventory,undefined,time,()=>0.999)
 restored.restoreState(state.progress,state.courierBoard,state.npcJobs)
 assert.deepEqual(restored.getSnapshot().courierBoard,state.courierBoard)
 assert.deepEqual(restored.getSnapshot().progress[0].parameters,parameters)
 assert.equal(restored.advanceDialogue(offer.id,parameters.sourceId,'courier-pickup'),false)
 assert.equal(inventory.getSnapshot().items.filter(i=>i.itemId==='courier-parcel').length,1)
})
test('completion cannot replenish the same day courier offer; the same template can run again next day',()=>{
 const {quests,time}=setup(),q=quests.getBoardQuests().find(q=>q.deliveryKind==='courier')
 quests.openBoard();quests.accept(q.id);quests.advanceDialogue(q.id,q.stages[0].trigger.npcId,'courier-pickup');quests.advanceDialogue(q.id,q.stages[1].trigger.npcId,'courier-deliver')
 assert.equal(quests.getBoardQuests().some(q=>q.deliveryKind==='courier'),false)
 time.nextMorning();assert.equal(quests.getBoardQuests().some(q=>q.deliveryKind==='courier'),true)
 quests.openBoard();quests.accept(q.id);assert.equal(quests.isActive(q.id),true)
 assert.equal(quests.getSnapshot().progress.filter(p=>p.questId===q.id).length,1)
})
