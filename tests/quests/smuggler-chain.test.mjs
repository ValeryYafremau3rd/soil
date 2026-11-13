import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { buildVendorSeeds } from '../../src/app/content/vendorSeeds.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'
import { LockpickingService } from '../../src/app/services/LockpickingService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { refreshContainersEachMorning } from '../../src/app/services/refreshContainersEachMorning.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses, unmetItemRequirements } from '../../src/domain/inventory/items.ts'
import { rollLockTarget } from '../../src/domain/buildings/lockpicking.ts'
import classes from '../../src/content/classes.json' with { type: 'json' }

test('Dusan chain enforces order, night crates, locks, combined barter and atomic final rewards', () => {
  const data = content(), time = new DayTime(), messages = []
  const seeds = [...buildContainerSeeds(data.containers, data.items), ...buildVendorSeeds(data.dialogues, data.items)]
  const inventory = new InventoryService(data.items, seeds, () => 0, [], undefined, undefined,
    (id, name, done, rarity) => locks.attemptContainer(id, name, done, rarity), text => messages.push(text), () => 20, false,
    id => { const seed = seeds.find(seed => seed.id === id)
      return (!seed.nightOnly || time.getSnapshot().phase === 'night')
        && (!seed.questId || quests.isActive(seed.questId)) && (!seed.questIds || seed.questIds.some(id => quests.isActive(id)))
        && (!seed.requiresQuest || quests.isCompleted(seed.requiresQuest))
    }, () => 20, () => ({ lockpicking: 20 }), undefined, undefined, (id,itemId) => quests.canTakeDeliveryItem(id,itemId))
  const quests = new QuestService(data.quests, inventory, text => messages.push(text), time, () => 0)
  const locks = new LockpickingService(time, () => 20, data.skills, {
    has: () => inventory.getSnapshot().items.some(item => item.itemId === 'lockpick'),
    canUse: () => inventory.canUseItem('lockpick'), consume: () => inventory.consumeItem('lockpick'),
  }, () => 0, () => 0.999)
  const dialogue = new DialogueService(inventory.openContainer, {
    canChoose: (npc, choice) => quests.canAdvanceDialogue(choice.questId, npc, choice.id),
    choose: (npc, choice) => quests.advanceDialogue(choice.questId, npc, choice.id),
    canOffer: quests.canOffer, acceptFromNpc: quests.acceptFromNpc, isCompleted: quests.isCompleted,
  })
  refreshContainersEachMorning(time, inventory)
  const talk = () => dialogue.openDialogue('Dusan', data.dialogues['citizen-mechanic'], 'citizen-mechanic')
  const hasReply = id => dialogue.getSnapshot().conversation.choices.some(choice => choice.id === id)
  assert.ok(quests.getOffer('citizen-mechanic'))
  assert.equal(quests.acceptFromNpc('smuggler-3', 'citizen-mechanic'), false)
  assert.equal(quests.acceptFromNpc('smuggler-1', 'worker'), false)
  quests.openBoard(); quests.accept('smuggler-1')
  assert.equal(quests.isActive('smuggler-1'), false, 'NPC offers cannot be accepted through a board call')
  talk(); assert.ok(hasReply('smuggler-trade'))
  dialogue.chooseReply('smuggler-trade')
  assert.equal(inventory.getSnapshot().menu.containerId, 'merchant:worker-basic')
  inventory.closeMenu()
  for (const [index, crateId, itemId] of [[1,'smuggler-living-crate','smuggler-parcel'],[2,'cashier-5-crate','smuggler-parcel'],[3,'smuggler-factory-crate','smuggler-parcel']]) {
    time.nextMorning(); inventory.closeMenu()
    assert.equal(inventory.getSnapshot().containers[crateId].items.some(item=>item.itemId==='smuggler-parcel'),false)
    talk(); assert.ok(hasReply(`smuggler-${index}-offer`))
    if (index < 3) assert.equal(hasReply(`smuggler-${index+1}-offer`), false)
    dialogue.chooseReply(`smuggler-${index}-offer`)
    assert.equal(quests.getOffer('worker'), data.quests.find(q => q.id === 'mechanic-scrap').offerText)
    inventory.openContainer(crateId); const daytimeInventory=inventory.getSnapshot();inventory.takeItem(itemId);assert.equal(inventory.getSnapshot(),daytimeInventory)
    for (let i=0;i<3;i++) time.advance()
    inventory.openContainer(crateId)
    if (index === 3) {
      assert.equal(locks.getSnapshot().puzzle, null, 'factory crate opens without a second lock')
      assert.equal(inventory.getSnapshot().menu.containerId, crateId)
    }
    inventory.takeItem(itemId)
    inventory.closeMenu()
    if (index === 3) {
      inventory.grantItems([{ itemId:'sun-amulet',quantity:1 }])
      const room = inventory.getCapacity() - inventory.getSnapshot().items.length
      inventory.grantItems([{ itemId:'cloth',quantity:room }])
      const before = inventory.getSnapshot()
      assert.equal(quests.advanceDialogue('smuggler-3','citizen-mechanic','smuggler-3-deliver'),false)
      assert.equal(inventory.getSnapshot(),before)
      inventory.removeItems([{itemId:'cloth',quantity:1}])
    }
    talk(); dialogue.chooseReply(`smuggler-${index}-deliver`)
    assert.ok(quests.isCompleted(`smuggler-${index}`))
    assert.equal(quests.advanceDialogue(`smuggler-${index}`,'citizen-mechanic',`smuggler-${index}-deliver`),false)
    if (index === 1) assert.match(dialogue.getSnapshot().conversation.text,/smuggler.*warehouse/)
    talk(); assert.ok(hasReply('smuggler-trade'))
    assert.equal(hasReply('smuggler-locks'), false)
    dialogue.chooseReply('smuggler-trade')
    assert.equal(inventory.getSnapshot().menu.containerId,'merchant:worker-basic')
    inventory.closeMenu()
  }
  assert.equal(inventory.getSnapshot().money,40)
  assert.ok(inventory.hasDoorKey('apartments:apartment-12'))
  assert.ok(inventory.getSnapshot().items.some(item=>item.itemId==='triquetra-pendant'))
  assert.ok(quests.getOffer('citizen-mechanic'))
  const restored = new QuestService(data.quests,inventory)
  restored.restoreState(quests.getSnapshot().progress)
  assert.ok(restored.isCompleted('smuggler-3'))
  assert.ok(restored.getOffer('citizen-mechanic'))
})

test('rarity controls maximum lock sum and Loader can train using Dusan unlocked shop goods', () => {
  const data=content()
  for(const [rarity,max] of Object.entries({common:12,uncommon:20,rare:27})) {
    assert.equal(rollLockTarget(rarity,data.skills,()=>0.999999),max)
    assert.equal(rollLockTarget(rarity,data.skills,()=>0),4)
  }
  const loader=createCharacter(classes.find(entry=>entry.id==='loader'))
  const definitions=Object.fromEntries(data.items.map(item=>[item.id,item]))
  const trained=applyCarriedBonuses(loader,['smuggler-lock-guide','pliers'].map(itemId=>({itemId,quantity:1})),definitions)
  assert.ok(trained.skills.lockpicking > loader.skills.lockpicking)
  assert.deepEqual(unmetItemRequirements(definitions.lockpick, trained.skills), [])
})

test('quest chain and trade references reject cycles, unknown gates and invalid rarity difficulty', () => {
  for(const change of [
    data=>{data.quests.find(q=>q.id==='smuggler-1').prerequisites=['smuggler-3']},
    data=>{data.quests.find(q=>q.id==='smuggler-2').prerequisites=['missing']},
    data=>{data.dialogues['citizen-mechanic'].barters[0].requiresQuest='missing'},
    data=>{data.dialogues['citizen-mechanic'].nodes.greeting.choices[0].acceptQuestId='missing'},
    data=>{data.skills.lockpickingMaxSumByRarity.rare=28},
    data=>{data.skills.lockpickingMaxSumByRarity.common=25},
  ]) { const data=content();change(data);assert.throws(()=>validateContent(data)) }
})


test('Dusan notes and pliers give every class a route to precision tools without self-unlocking', () => {
  const data = content()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  for (const definition of classes) {
    const character = applyCarriedBonuses(createCharacter(definition), ['smuggler-lock-guide', 'pliers'].map(itemId => ({ itemId, quantity: 1 })), definitions)
    const inventory = new InventoryService(data.items, [], () => 0, [], undefined, undefined,
      undefined, () => {}, () => character.skills.erudition, false, undefined, undefined, () => character.skills)
    for (const id of ['lockpick', 'pliers', 'precision-screwdriver', 'flashlight', 'smuggler-lock-guide']) {
      assert.equal(inventory.canUseItem(id), true, definition.id + ': ' + id)
    }
  }
})

test('final apartment job advances on looting and keeps the pistol and five bullets', () => {
  const data = content(), messages = []
  const seed = buildContainerSeeds(data.containers, data.items).find(seed => seed.id === 'smuggler-apartment-safe')
  assert.equal(seed.locked, true)
  assert.equal(seed.questId, undefined)
  const inventory = new InventoryService(data.items, [seed], () => 0)
  const quests = new QuestService(data.quests, inventory, text => messages.push(text))
  assert.equal(quests.acceptFromNpc('smuggler-4', 'citizen-mechanic'), false)
  quests.restoreState([1,2,3].map(i => ({questId:'smuggler-' + i, stageIndex:data.quests.find(q=>q.id==='smuggler-' + i).stages.length})))
  assert.equal(quests.acceptFromNpc('smuggler-4', 'citizen-mechanic'), true)
  inventory.grantItems([{itemId:'service-pistol',quantity:1}])
  assert.equal(quests.getSnapshot().progress.find(p=>p.questId==='smuggler-4').stageIndex, 1)
  inventory.grantItems([{itemId:'pistol-ammunition',quantity:4}])
  assert.equal(quests.isCompleted('smuggler-4'), false)
  inventory.grantItems([{itemId:'pistol-ammunition',quantity:1}])
  assert.equal(quests.isCompleted('smuggler-4'), true)
  assert.equal(inventory.getSnapshot().items.find(i=>i.itemId==='pistol-ammunition').quantity, 5)
  assert.ok(inventory.getSnapshot().items.some(i=>i.itemId==='service-pistol'))
  assert.equal(quests.acceptFromNpc('smuggler-4', 'citizen-mechanic'), false)
  assert.ok(quests.getOffer('citizen-mechanic'))
  assert.ok(messages.some(text=>text.endsWith(' updated.')))
})
