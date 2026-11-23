import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
const stack=(itemId,quantity=1)=>({itemId,quantity})
function setup(items=[]){
 const data=content(),time=new DayTimeService(),inventory=new InventoryService(data.items,[],()=>0,items)
 const quests=new QuestService(data.quests,inventory,undefined,time,()=>0)
 const dialogue=new DialogueService(()=>{}, {canChoose:(npc,c)=>quests.canAdvanceDialogue(c.questId,npc,c.id),choose:(npc,c)=>quests.advanceDialogue(c.questId,npc,c.id),describeQuest:id=>quests.definitions.find(q=>q.id===id)?.description})
 const talk=npc=>dialogue.openDialogue(data.npcs[npc].name,data.dialogues[data.npcs[npc].dialogueId],npc)
 return {data,time,inventory,quests,dialogue,talk}
}
test('one generic courier template routes pickup and delivery to parameterized NPCs and pays only once',()=>{
 const data=content(),template=data.quests.find(q=>q.id==='courier-delivery')
 assert.equal(data.quests.filter(q=>q.id.startsWith('courier-')).length,1)
 for(let index=0;index<template.destinations.length;index++){
  const {inventory,quests,dialogue,talk}=setup();const board=structuredClone(quests.getSnapshot().courierBoard)
  const parameters={sourceId:template.destinations[index].id,destinationId:template.destinations[(index+1)%template.destinations.length].id}
  board.parameters['courier-delivery']=parameters;quests.restoreState([],board)
  const offer=quests.getBoardQuests().find(q=>q.id==='courier-delivery')
  assert.equal(offer.stages[0].trigger.npcId,parameters.sourceId)
  quests.openBoard();quests.accept(offer.id)
  assert.deepEqual(quests.getSnapshot().progress[0].parameters,parameters)
  assert.equal(quests.advanceDialogue(offer.id,parameters.destinationId,'courier-pickup'),false)
  assert.equal(quests.advanceDialogue(offer.id,parameters.destinationId,'courier-deliver'),false)
  talk(parameters.sourceId);dialogue.chooseReply('courier-pickup')
  assert.ok(dialogue.getSnapshot().conversation.text.includes(template.destinations[(index+1)%template.destinations.length].name))
  assert.deepEqual(inventory.getSnapshot().items,[stack('courier-parcel')])
  assert.equal(quests.advanceDialogue(offer.id,parameters.sourceId,'courier-pickup'),false)
  talk(parameters.destinationId);dialogue.chooseReply('courier-deliver')
  assert.equal(inventory.getSnapshot().money,offer.reward.money)
  assert.equal(inventory.getSnapshot().items.some(item=>item.itemId==='courier-parcel'),false)
  assert.equal(quests.advanceDialogue(offer.id,parameters.destinationId,'courier-deliver'),false)
 }
})
test('full inventory and lost courier parcels do not advance or issue duplicate items',()=>{
 const {quests,inventory}=setup(['rope','wrench','pliers','cloth','letter','postcard'].map(id=>stack(id)))
 const q=quests.getBoardQuests().find(q=>q.deliveryKind==='courier');quests.openBoard();quests.accept(q.id)
 const source=q.stages[0].trigger.npcId,destination=q.stages[1].trigger.npcId,before=inventory.getSnapshot()
 assert.equal(quests.advanceDialogue(q.id,source,'courier-pickup'),false);assert.equal(inventory.getSnapshot(),before)
 inventory.removeItems([stack('rope')]);assert.equal(quests.advanceDialogue(q.id,source,'courier-pickup'),true)
 inventory.removeItems([stack('courier-parcel')]);assert.equal(quests.advanceDialogue(q.id,destination,'courier-deliver'),false)
 assert.equal(quests.advanceDialogue(q.id,source,'courier-pickup'),false)
})
test('failed courier runs remove carried parcels and can start a new parameterized run on a later day',()=>{
 const {quests,time,inventory}=setup(),q=quests.getBoardQuests().find(q=>q.deliveryKind==='courier')
 quests.openBoard();quests.accept(q.id);quests.advanceDialogue(q.id,q.stages[0].trigger.npcId,'courier-pickup')
 for(let i=0;i<4;i++)time.advance()
 assert.equal(quests.getSnapshot().progress.find(p=>p.questId===q.id).failed,true)
 assert.equal(inventory.getSnapshot().items.some(i=>i.itemId==='courier-parcel'),false)
 time.nextMorning();quests.openBoard();quests.accept(q.id)
 assert.equal(quests.isActive(q.id),true)
 assert.equal(quests.getSnapshot().progress.filter(p=>p.questId===q.id).length,1)
})
test('courier generic destinations and shared parcel references are validated',()=>{
 for(const patch of [q=>{q.destinations[0].id='missing'},q=>{q.stages[0].grantItems[0].itemId='missing'},q=>{q.stages[0].grantItems[0].quantity=0},q=>{q.destinations=q.destinations.slice(0,1)}]){
  const {data,sources}=catalogue();patch(data.quests.find(q=>q.id==='courier-delivery'));assert.throws(()=>validateContent(data,sources))
 }
})
