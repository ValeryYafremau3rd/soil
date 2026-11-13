import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue, contentFiles } from '../helpers/content.mjs'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { resolveFindItemRewards } from '../../src/domain/quests/quests.ts'
const stack=(itemId,quantity=1)=>({itemId,quantity})
function setup(start=[]){const data=content(),time=new DayTime(),inventory=new InventoryService(data.items,[],()=>0,start),quests=new QuestService(data.quests,inventory,undefined,time,()=>0);return {data,time,inventory,quests}}
test('find-item uses one template with NPC/item parameters and displays exactly one affordable board request',()=>{
 const {data,quests}=setup();assert.equal(data.quests.filter(q=>q.findItem).length,1)
 const offers=()=>quests.getBoardQuests().filter(q=>q.findItem),q=offers()[0]
 assert.equal(q.id,'find-item');assert.ok(q.findItem!=='$item');assert.ok(q.reward.money>0&&q.reward.money<=40)
 assert.ok(!q.name.includes('{'));assert.ok(q.description.includes(data.items.find(i=>i.id===q.findItem).name))
 const before=structuredClone(quests.getSnapshot().courierBoard)
 quests.openBoard();quests.closeBoard();assert.deepEqual(quests.getSnapshot().courierBoard,before)
 quests.openBoard();quests.accept(q.id);assert.equal(offers().length,0)
 quests.openBoard();quests.accept(q.id);assert.equal(quests.getSnapshot().progress.filter(p=>p.questId===q.id).length,1)
})
test('requester, recipient and requested item control generic dialogue handover and payment',()=>{
 const {data,quests,inventory}=setup(),board=structuredClone(quests.getSnapshot().courierBoard)
 board.parameters['find-item']={sourceId:'bartender',destinationId:'worker',itemId:'bandage'}
 quests.restoreState([],board);const q=quests.getBoardQuests().find(q=>q.findItem)
 quests.openBoard();quests.accept(q.id)
 assert.equal(quests.advanceDialogue(q.id,'worker','find-item-start'),false)
 assert.equal(quests.advanceDialogue(q.id,'bartender','find-item-start'),true)
 assert.equal(quests.advanceDialogue(q.id,'worker','find-item-deliver'),false)
 inventory.grantItems([stack('bandage')]);assert.equal(quests.advanceDialogue(q.id,'bartender','find-item-deliver'),false)
 const dialogue=new DialogueService(()=>{},{canChoose:(npc,c)=>quests.canAdvanceDialogue(c.questId,npc,c.id),choose:(npc,c)=>quests.advanceDialogue(c.questId,npc,c.id)})
 dialogue.openDialogue(data.npcs.worker.name,data.dialogues[data.npcs.worker.dialogueId],'worker');dialogue.chooseReply('find-item-deliver')
 assert.equal(inventory.getSnapshot().items.some(i=>i.itemId==='bandage'),false)
 assert.equal(inventory.getSnapshot().money,data.items.find(i=>i.id==='bandage').price*2)
 assert.equal(quests.advanceDialogue(q.id,'worker','find-item-deliver'),false)
})
test('lost items and full reward capacity preserve requested quantities until an atomic turn-in succeeds',()=>{
 const {quests,inventory}=setup([stack('bandage',2),...['rope','wrench','pliers','cloth','letter'].map(id=>stack(id))]),board=structuredClone(quests.getSnapshot().courierBoard)
 board.parameters['find-item']={sourceId:'bartender',destinationId:'worker',itemId:'bandage'}
 quests.restoreState([],board);quests.openBoard();quests.accept('find-item');quests.advanceDialogue('find-item','bartender','find-item-start')
 const before=inventory.getSnapshot();assert.equal(quests.advanceDialogue('find-item','worker','find-item-deliver'),false);assert.equal(inventory.getSnapshot(),before)
 inventory.removeItems([stack('rope')]);assert.equal(quests.advanceDialogue('find-item','worker','find-item-deliver'),true)
 assert.equal(inventory.getSnapshot().items.find(i=>i.itemId==='bandage').quantity,1)
})
test('find-item parameters survive reload, and later runs reuse the same quest ID',()=>{
 const {data,quests,time,inventory}=setup(),q=quests.getBoardQuests().find(q=>q.findItem)
 quests.openBoard();quests.accept(q.id);quests.advanceDialogue(q.id,q.stages[0].trigger.npcId,'find-item-start')
 const saved=structuredClone(quests.getSnapshot()),restored=new QuestService(data.quests,inventory,undefined,time,()=>0.999)
 restored.restoreState(saved.progress,saved.courierBoard,saved.npcJobs)
 assert.deepEqual(restored.getSnapshot().progress,saved.progress)
 inventory.grantItems([stack(q.findItem)]);assert.equal(restored.advanceDialogue(q.id,q.stages[1].trigger.npcId,'find-item-deliver'),true)
 assert.equal(restored.getBoardQuests().some(q=>q.findItem),false);time.nextMorning();assert.equal(restored.getBoardQuests().filter(q=>q.findItem).length,1)
})
test('catalogue discovery adds eligible item options rather than additional quests',()=>{
 const files=contentFiles();files['./items/test-tool.json']={...files['./items/screwdriver.json'],id:'test-tool',name:'Test tool'};files['./items/protected-tool.json']={...files['./items/screwdriver.json'],id:'protected-tool',saleable:false}
 const {data,sources}=assembleContent(files);validateContent(data,sources)
 assert.equal(data.quests.filter(q=>q.findItem).length,1)
 assert.ok(data.quests.find(q=>q.findItem).findItemOptions.some(i=>i.id==='test-tool'))
 assert.equal(data.quests.find(q=>q.findItem).findItemOptions.some(i=>i.id==='protected-tool'),false)
})
test('find rewards use configured prices across rarities and invalid template references fail',()=>{
 const data=content()
 for(const rarity of ['common','uncommon','rare','epic','legendary']){
  const [q]=resolveFindItemRewards([{id:'test',findItem:'item',stages:[]}],[{id:'item',price:17,rarity}],data.daytime.findItemRewardMultipliers);assert.equal(q.reward.money,34)
 }
 for(const patch of [q=>{q.findItemOptions[0].id='missing'},q=>{q.reward={money:1}},q=>{q.stages[1].removeItems[0].quantity=2},q=>{q.destinations[0].id='missing'}]){
  const {data,sources}=catalogue();patch(data.quests.find(q=>q.id==='find-item'));assert.throws(()=>validateContent(data,sources))
 }
})
