import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
function setup(roll=0){const data=content(),time=new DayTime(),inventory=new InventoryService(data.items,[]),quests=new QuestService(data.quests,inventory,undefined,time,()=>roll);const unlock=()=>quests.restoreState([1,2,3,4].map(n=>({questId:`smuggler-${n}`,stageIndex:data.quests.find(q=>q.id===`smuggler-${n}`).stages.length})));return {data,time,inventory,quests,unlock}}
test('Dusan offers one generic smuggler run after the story and preserves randomized locations on reload',()=>{
 const targets=new Set()
 for(const roll of [0,0.2,0.4,0.6,0.8,0.999]){
  const {data,time,inventory,quests,unlock}=setup(roll)
  assert.equal(quests.canOffer('smuggler-delivery','citizen-mechanic'),false);unlock()
  const jobs=structuredClone(quests.getSnapshot().npcJobs)
  assert.deepEqual(jobs.offeredQuestIds,['smuggler-delivery'])
  const values=jobs.parameters['smuggler-delivery'];assert.notEqual(values.sourceId,values.destinationId);targets.add(JSON.stringify(values))
  quests.openBoard();quests.accept('smuggler-delivery');assert.equal(quests.isActive('smuggler-delivery'),false)
  assert.equal(quests.acceptFromNpc('smuggler-delivery','worker'),false)
  assert.equal(quests.acceptFromNpc('smuggler-delivery','citizen-mechanic'),true)
  assert.equal(quests.acceptFromNpc('smuggler-delivery','citizen-mechanic'),false)
  assert.deepEqual(quests.getSnapshot().progress.find(p=>p.questId==='smuggler-delivery').parameters,values)
  const state=quests.getSnapshot(),restored=new QuestService(data.quests,inventory,undefined,time,()=>0.999)
  restored.restoreState(state.progress,state.courierBoard,state.npcJobs)
  assert.deepEqual(restored.getSnapshot().npcJobs,state.npcJobs)
  assert.equal(restored.getOffer('worker'),data.quests.find(q => q.id === 'mechanic-scrap').offerText)
 }
 assert.ok(targets.size>=3)
})
test('Dusan acceptance dialogue names the selected source and destination and the final return for payment',()=>{
 const {data,quests,unlock}=setup();unlock()
 const dialogue=new DialogueService(()=>{},{canChoose:(npc,c)=>quests.canAdvanceDialogue(c.questId,npc,c.id),choose:(npc,c)=>quests.advanceDialogue(c.questId,npc,c.id),canOffer:quests.canOffer,acceptFromNpc:quests.acceptFromNpc,describeQuest:id=>quests.definitions.find(q=>q.id===id)?.description})
 dialogue.openDialogue(data.npcs['citizen-mechanic'].name,data.dialogues['citizen-mechanic'],'citizen-mechanic')
 // Offers live in the existing greeting node.
 dialogue.chooseReply('smuggler-delivery-offer')
 const q=quests.definitions.find(q=>q.id==='smuggler-delivery'),text=dialogue.getSnapshot().conversation.text,values=quests.getSnapshot().progress.find(p=>p.questId===q.id).parameters
 for(const id of [values.sourceId,values.destinationId])assert.ok(text.includes(q.destinations.find(d=>d.id===id).name))
 assert.ok(text.includes('return to Dusan'))
})
test('apartment containers remain ordinary loot and old per-route radiant definitions are absent',()=>{
 const {data}=setup()
 assert.equal(data.quests.some(q=>q.id.startsWith('dusan-')),false)
 for(const container of data.containers.placements.filter(c=>c.roomId)){assert.equal(container.questId,undefined);assert.equal(container.questIds,undefined)}
 assert.equal(data.quests.filter(q=>q.repeatable&&q.offeredBy==='citizen-mechanic').length,1)
})
