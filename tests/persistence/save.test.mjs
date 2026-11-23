import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { OptionsService } from '../../src/app/services/session/OptionsService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { TravelService } from '../../src/app/services/world/TravelService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { LockpickingService } from '../../src/app/services/puzzles/LockpickingService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { drainStatusWithTime } from '../../src/app/services/character/drainStatusWithTime.ts'
import { refreshContainersEachMorning } from '../../src/app/services/inventory/refreshContainersEachMorning.ts'
import { buildContainerSeeds } from '../../src/app/content/containerSeeds.ts'
import { buildVendorSeeds } from '../../src/app/content/vendorSeeds.ts'
import { roomContainerPlacements } from '../../src/app/content/roomContainerPlacements.ts'
import { validateSave } from '../../src/app/persistence/validateSave.ts'
import { GAME_VERSION, SaveCompatibilityError } from '../../src/app/version.ts'

test('retired strap quest progress is removed without changing rewards or other progress', () => {
  for (const stageIndex of [0, 1, 2, 3]) {
    const { save, references } = setup()
    const previousQuests = structuredClone(save.quests)
    save.quests.push({ questId: 'a-fraying-strap', stageIndex })
    const migrated = validateSave(save, references)
    assert.deepEqual(migrated.quests, previousQuests)
    assert.deepEqual(migrated.inventory, save.inventory)
    assert.deepEqual(validateSave(migrated, references), migrated)
    assert.ok(save.quests.some(quest => quest.questId === 'a-fraying-strap'))
  }
})

test('slotless currency saves allow extra money stacks but never extra ordinary items', () => {
  const { save, references } = setup()
  save.inventory.items = [
    ...Array.from({ length: 6 }, () => ({ itemId: 'cloth', quantity: 1 })),
    { itemId: 'money', quantity: 100 },
    { itemId: 'money', quantity: 100 },
    { itemId: 'money', quantity: 5 },
  ]
  save.inventory.currencyInInventory = true
  save.inventory.slotlessMoney = true
  save.inventory.money = 205
  assert.equal(validateSave(save, references).inventory.money, 205)
  save.inventory.slotlessMoney = false
  assert.throws(() => validateSave(save, references))
  save.inventory.slotlessMoney = true
  save.inventory.items.push({ itemId: 'cloth', quantity: 1 })
  assert.throws(() => validateSave(save, references))
})

test('removed barracks toolbox migrates stored items, deposits and cache progress to the taskboard suitcase', () => {
  const { save, references } = setup()
  save.inventory.containers['barracks-roof-suitcase'] = { items: [{ itemId: 'bandage', quantity: 1 }], locked: false }
  save.inventory.containers['living-taskboard-suitcase'] = { items: [], locked: false }
  save.inventory.deposits['barracks-roof-suitcase'] = [{ itemId: 'bandage', quantity: 1 }]
  save.inventory.lootedCaches = ['barracks-roof-suitcase']
  const migrated = validateSave(save, references)
  assert.equal(migrated.inventory.containers['barracks-roof-suitcase'], undefined)
  assert.deepEqual(migrated.inventory.containers['living-taskboard-suitcase'].items, [{ itemId: 'bandage', quantity: 1 }])
  assert.deepEqual(migrated.inventory.deposits['living-taskboard-suitcase'], [{ itemId: 'bandage', quantity: 1 }])
  assert.deepEqual(migrated.inventory.lootedCaches, ['living-taskboard-suitcase'])
  assert.deepEqual(validateSave(migrated, references), migrated)
})

test('game versions preserve compatible saves and reject other compatibility versions and malformed versions', () => {
  const { save, references } = setup()
  assert.doesNotThrow(() => validateSave(save, references), 'legacy saves remain supported in the initial compatibility family')
  for (const gameVersion of [GAME_VERSION, '0.2.0.2', '0.2.0.99']) {
    const versioned = { ...save, gameVersion }
    assert.deepEqual(validateSave(versioned, references), versioned)
  }
  for (const gameVersion of ['0.1.0.1', '0.3.0.1', '0.2.0.0', '1.2.0.1', '0.2.1.1', '0.2.0', 'garbage']) {
    assert.throws(() => validateSave({ ...save, gameVersion }, references), SaveCompatibilityError)
  }
})

test('incompatible game versions report both versions without replacing the session or stored save', () => {
  const { save, references } = setup()
  const raw = JSON.stringify({ ...save, gameVersion: '0.1.0.1' })
  const messages = []
  let loads = 0, writes = 0
  const options = new OptionsService({ read: () => raw, write: () => { writes++ } }, () => save,
    value => validateSave(value, references), () => { loads++ }, () => {}, message => messages.push(message))
  options.load()
  options.load()
  assert.equal(loads, 0)
  assert.equal(writes, 0)
  assert.equal(messages.length, 2)
  assert.ok(messages.every(message => message.includes('0.1.0.1') && message.includes(GAME_VERSION) && message.includes('incompatible')))
})

test('daily intimidation records survive validation and reject unknown NPCs and future days', () => {
  const { save, references } = setup()
  const id = references.npcIds[0]
  save.intimidatedDays = { [id]: save.daytime.day }
  assert.deepEqual(validateSave(save, references).intimidatedDays, save.intimidatedDays)
  save.intimidatedDays = { [id]: save.daytime.day + 1 }
  assert.throws(() => validateSave(save, references))
  save.intimidatedDays = { missing: 1 }
  assert.throws(() => validateSave(save, references))
})

test('advice days and Nerd/Punk progress persist, with legacy defaults and incompatible records rejected', () => {
  const { save, references } = setup()
  assert.equal(validateSave(save, references).adviceDays, undefined)
  const id = references.npcIds[0]
  save.adviceDays = { [id]: save.daytime.day }
  save.perks = { counts: { nerd: 10, punk: 9 }, acquired: ['nerd'], habits: {} }
  const restored = validateSave(save, references)
  assert.deepEqual(restored.adviceDays, save.adviceDays)
  assert.deepEqual(restored.perks, save.perks)
  save.perks = { counts: { punk: 10 }, acquired: ['punk'], habits: {} }
  assert.deepEqual(validateSave(save, references).perks, save.perks)
  save.perks = { counts: { nerd: 10, punk: 10 }, acquired: ['nerd', 'punk'], habits: {} }
  assert.throws(() => validateSave(save, references))
  delete save.perks
  for (const record of [{ missing: 1 }, { [id]: save.daytime.day + 1 }, { [id]: 0 }]) {
    save.adviceDays = record
    assert.throws(() => validateSave(save, references))
  }
})

test('legendary stat stock survives validation and rejects quest items and missing visible stock',()=>{
 const {save,references}=setup()
 const vendor=save.inventory.containers['merchant:worker-basic']
 vendor.items.push({itemId:'work-jacket',quantity:1})
 save.inventory.legendaryBarterStock={visible:true,items:[{itemId:'work-jacket',quantity:1}]}
 assert.deepEqual(validateSave(save,references).inventory.legendaryBarterStock,save.inventory.legendaryBarterStock)
 vendor.items=vendor.items.filter(item=>item.itemId!=='work-jacket')
 assert.throws(()=>validateSave(save,references))
 save.inventory.legendaryBarterStock.visible=false
 assert.ok(validateSave(save,references))
 save.inventory.legendaryBarterStock.items=[{itemId:'courier-parcel',quantity:1}]
 assert.throws(()=>validateSave(save,references))
})

function setup() {
  const data = content()
  const placements = [...data.containers.placements, ...roomContainerPlacements(data.locations, data.buildings, data.rooms)]
  const seeds = [...buildContainerSeeds({ ...data.containers, placements }, data.items),
    ...buildVendorSeeds(data.dialogues, data.items)]
  const inventory = new InventoryService(data.items, seeds, () => 0)
  const references = { optionalContainerIds: seeds.filter(seed => seed.questId || seed.questIds?.length || seed.requiresQuest || seed.id === 'merchant:citizen-nurse').map(seed=>seed.id), npcIds: Object.keys(data.npcs), classIds: classes.map(entry => entry.id), difficultyIds: data.difficulty.presets.map(entry => entry.id), locations: data.locations,
    items: data.items, quests: data.quests, buildings: data.buildings, rooms: data.rooms, containerIds: seeds.map(seed => seed.id), travelsPerPhase: data.daytime.travelsPerPhase }
  const position = { locationId: 'living-district', buildingId: 'apartments', roomId: 'apartment-21', floor: 1, x: 500, y: 500 }
  const save = { version: 1, openingVersion: 1, escapeCluesVersion: 1, savedAt: '2026-11-10T12:00:00.000Z', classId: 'safecracker', difficultyId: data.difficulty.defaultId,
    daytime: { day: 2, phase: 'evening' }, status: { health: 42, energy: 31, sanity: 27 },
    inventory: inventory.saveState(), quests: [{ questId: 'way-out-of-town', stageIndex: 0 }],
    travel: { locationId: 'living-district', phaseTravels: 1 }, unlockedDoors: ['2:apartments:apartment-22'], position }
  return { data, seeds, inventory, references, position, save }
}

test('alignment progress and winners persist without addiction habits; conflicting or incomplete winners fail', () => {
  const { save, references } = setup()
  save.perks = { counts: { lawful: 50, unlawful: 18 }, acquired: ['lawful'], habits: {} }
  assert.deepEqual(validateSave(save, references).perks, save.perks)
  for (const change of [
    state => { state.counts.lawful = 49 },
    state => { state.counts.unlawful = 51 },
    state => { state.counts.unlawful = 50; state.acquired.push('unlawful') },
    state => { state.habits.lawful = { lastUse: 0, lastPenalty: 0, sanity: 0 } },
  ]) {
    const invalid = structuredClone(save)
    change(invalid.perks)
    assert.throws(() => validateSave(invalid, references))
  }
})

test('new action perks save alongside alignment and reject competing winners in either new group', () => {
  const { save, references } = setup()
  save.perks = { counts: { lawful: 50, hoarder: 5, bruiser: 10, scalper: 4, skulker: 2 }, acquired: ['lawful', 'hoarder', 'bruiser'], habits: {} }
  assert.deepEqual(validateSave(save, references).perks, save.perks)
  for (const id of ['scalper', 'skulker']) {
    const invalid = structuredClone(save)
    invalid.perks.counts[id] = 10
    invalid.perks.acquired.push(id)
    assert.throws(() => validateSave(invalid, references))
  }
})

test('night saves accept extended travel progress but reject a completed night', () => {
  const { save, references } = setup()
  save.daytime.phase = 'night'
  save.travel.phaseTravels = 4
  assert.equal(validateSave(save, references).travel.phaseTravels, 4)
  save.travel.phaseTravels = 6
  assert.throws(() => validateSave(save, references))
  save.daytime.phase = 'morning'
  save.travel.phaseTravels = 4
  assert.throws(() => validateSave(save, references))
})

test('timed buffs survive saves; unknown, duplicate and excessive expiry values are rejected', () => {
  const { save, references } = setup()
  save.perks = { counts: {}, acquired: [], habits: {}, buffs: [{ id: 'calm', expiresAt: 9 }] }
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save)), references).perks, save.perks)
  for (const patch of [
    value => { value.perks.buffs[0].id = 'missing' },
    value => { value.perks.buffs.push({ id: 'calm', expiresAt: 9 }) },
    value => { value.perks.buffs[0].expiresAt = 100 },
    value => { value.perks.buffs[0].expiresAt = -1 },
  ]) {
    const invalid = structuredClone(save)
    patch(invalid)
    assert.throws(() => validateSave(invalid, references))
  }
})

test('perk progress and withdrawal clocks survive saves; invalid winners and clocks are rejected', () => {
  const { save, references } = setup()
  save.perks = { counts: { 'alcohol-addiction': 10 }, acquired: ['alcohol-addiction'],
    habits: { 'alcohol-addiction': { lastUse: 2, lastPenalty: 6, sanity: 25 } } }
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save)), references).perks, save.perks)
  for (const patch of [
    value => { value.perks.acquired.push('missing') },
    value => { value.perks.acquired.push('alcohol-addiction') },
    value => { value.perks.counts['alcohol-addiction'] = 9 },
    value => { value.perks.habits['alcohol-addiction'].lastPenalty = 100 },
    value => { value.perks.habits['alcohol-addiction'].lastUse = 7 },
    value => { value.perks.acquired.push('smoking-addiction'); value.perks.counts['smoking-addiction'] = 10;
      value.perks.habits['smoking-addiction'] = { lastUse: 2, lastPenalty: 6, sanity: 8 } },
  ]) {
    const invalid = JSON.parse(JSON.stringify(save))
    patch(invalid)
    assert.throws(() => validateSave(invalid, references))
  }
})

test('attached keys and one daily NPC job survive saves and reject invalid references or extra daily jobs', () => {
  const { data, save, references, inventory } = setup()
  inventory.grantItems([{ itemId: 'key-ring', quantity: 1 }, { itemId: 'boris-apartment-keys', quantity: 1 }])
  save.inventory = inventory.saveState()
  save.quests = [1, 2, 3, 4].map(n => {
    const quest = data.quests.find(q => q.id === 'smuggler-' + n)
    return { questId: quest.id, stageIndex: quest.stages.length }
  })
  const id = 'smuggler-delivery'
  const parameters = { sourceId: 'center', destinationId: 'factory' }
  save.quests.push({ questId: id, stageIndex: 0, parameters })
  save.npcJobs = { day: save.daytime.day, offeredQuestIds: [id], acceptedQuestIds: [id], parameters: { [id]: parameters } }
  const validated = validateSave(JSON.parse(JSON.stringify(save)), references)
  assert.deepEqual(validated, save)
  inventory.restoreState(validated.inventory)
  assert.equal(inventory.hasDoorKey('apartments:apartment-12'), true)
  for (const patch of [
    value => { value.inventory.keyItems = ['missing'] },
    value => { value.inventory.keyItems = ['key-ring'] },
    value => { value.inventory.keyItems.push('boris-apartment-keys') },
    value => { value.npcJobs.day++ },
    value => { value.npcJobs.offeredQuestIds = ['missing'] },
    value => { value.npcJobs.offeredQuestIds.push('dusan-apartment-31') },
    value => { value.npcJobs.acceptedQuestIds.push(id) },
    value => { value.npcJobs.acceptedQuestIds = ['dusan-apartment-31'] },
    value => { value.npcJobs.offeredQuestIds = ['courier-bartender'] },
    value => { value.quests = value.quests.filter(q => q.questId !== 'smuggler-4') },
  ]) {
    const invalid = structuredClone(save); patch(invalid)
    assert.throws(() => validateSave(invalid, references))
  }
})

test('discovered notes and sleep debt survive saves; legacy saves remain compatible', () => {
  const { save, references } = setup()
  assert.deepEqual(validateSave(save, references), save)
  save.notes = { locations: ['living-district'], people: ['bartender'], items: ['key-ring'] }
  save.awakePhases = 7
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save)), references), save)
  for (const patch of [
    value => { value.notes.locations.push('living-district') },
    value => { value.notes.people.push('missing') },
    value => { value.notes.items.push('missing') },
    value => { value.notes.locations.push('missing') },
    value => { value.awakePhases = -1 },
    value => { value.awakePhases = 0.5 },
  ]) {
    const invalid = structuredClone(save); patch(invalid)
    assert.throws(() => validateSave(invalid, references))
  }
})

test('weather survives save validation, legacy saves work, and unknown effects are rejected', () => {
  const { save, references } = setup()
  for (const weather of ['rain', 'snow', 'fog', 'storm', 'wind', 'clear']) {
    const candidate = structuredClone(save)
    candidate.daytime.weather = weather
    assert.equal(validateSave(candidate, references).daytime.weather, weather)
  }
  const legacy = structuredClone(save)
  delete legacy.daytime.weather
  assert.doesNotThrow(() => validateSave(legacy, references))
  legacy.daytime.weather = 'hail'
  assert.throws(() => validateSave(legacy, references))
})

test('sleep autosaves settled morning state once; bench rest and cancellation do not overwrite it', () => {
  const { save, references, data, inventory, position } = setup()
  const time = new DayTimeService(2, 'night')
  const status = new StatusService(['health', 'energy', 'sanity'].map(id => ({ id, value: 40, max: 100 })))
  const quests = new QuestService(data.quests, inventory, undefined, time, () => 0)
  let raw = null, writes = 0, loaded = null
  const options = new OptionsService({ read: () => raw, write: value => { raw = value; writes++ } }, () => ({ ...save,
    daytime: time.getSnapshot(), status: status.getSnapshot(), inventory: inventory.saveState(),
    quests: quests.getSnapshot().progress, courierBoard: quests.getSnapshot().courierBoard, awakePhases: sleep.awakePhases,
  }), value => validateSave(value, references), value => { loaded = value }, () => {}, () => {})
  options.updatePosition(position)
  const rest = new RestService(time, status, { rest: { energy: 15 }, sleep: { health: 50, energy: 50, sanity: 20 } }, () => {
    assert.equal(rest.isSleeping, false)
    assert.equal(rest.isAdvancingTime, false)
    options.save()
  })
  const sleep = { ...data.daytime.sleepDeprivation, awakePhases: 8, isSleeping: () => rest.isSleeping }
  drainStatusWithTime(time, status, { energy: 2, sanity: 1 }, () => rest.isAdvancingTime, sleep)
  refreshContainersEachMorning(time, inventory)
  rest.open('sleep', 'Bed'); rest.close(); rest.confirm()
  assert.equal(writes, 0)
  rest.open('sleep', 'Bed'); rest.confirm()
  assert.equal(writes, 1)
  const saved = JSON.parse(raw)
  assert.deepEqual((({ day, phase }) => ({ day, phase }))(saved.daytime), { day: 3, phase: 'morning' })
  assert.deepEqual(saved.status, { health: 90, energy: 90, sanity: 59 })
  assert.equal(saved.awakePhases, 0)
  assert.equal(saved.courierBoard.day, 3)
  assert.deepEqual(saved.inventory, inventory.saveState(), 'all morning stock refreshes finish before autosave')
  rest.confirm()
  rest.open('rest', 'Bench'); rest.confirm()
  assert.equal(writes, 1)
  assert.equal(raw, JSON.stringify(saved), 'rest preserves the last sleep checkpoint')
  status.takeDamage(999)
  options.load()
  assert.deepEqual(loaded, saved, 'a dead hero can load the living saved state')
  rest.open('sleep', 'Bed'); rest.confirm()
  assert.equal(writes, 2, 'another completed sleep triggers another save')
})

test('legacy saves seed new story crates and vendors, while invalid chain ordering is rejected', () => {
  const {save,references,inventory}=setup()
  for(const id of references.optionalContainerIds) delete save.inventory.containers[id]
  assert.doesNotThrow(()=>validateSave(save,references))
  inventory.restoreState(save.inventory)
  for(const id of references.optionalContainerIds) assert.ok(inventory.getSnapshot().containers[id])
  save.quests=[{questId:'smuggler-3',stageIndex:0}]
  assert.throws(()=>validateSave(save,references))
  save.quests=[{questId:'smuggler-1',stageIndex:2},{questId:'smuggler-2',stageIndex:2},{questId:'smuggler-3',stageIndex:0}]
  assert.doesNotThrow(()=>validateSave(save,references))
})

test('saved inventories use equipped bag capacity and reject carried-bag overflow', () => {
  const { data, save, references, seeds } = setup()
  const items = ['rope', 'wrench', 'pliers', 'cloth', 'work-pass', 'coins', 'portrait', 'letter'].map(itemId => ({ itemId, quantity: 1 }))
  const inventory = new InventoryService(data.items, seeds, () => 0)
  const saved = inventory.saveState()
  saved.items = items
  saved.equipment = { bag: 'canvas-backpack' }
  inventory.restoreState(saved)
  save.inventory = inventory.saveState()
  assert.equal(validateSave(save, references).inventory.items.length, 8)
  const restored = new InventoryService(data.items, seeds, () => 0)
  restored.restoreState(save.inventory)
  assert.equal(restored.getCapacity(), 9)
  assert.deepEqual(restored.getSnapshot().items, items)
  save.inventory.equipment = {}
  save.inventory.items = [...items, { itemId: 'canvas-backpack', quantity: 1 }]
  assert.throws(() => validateSave(save, references), /incompatible content/)
})

test('daily courier offers and acceptance survive saves and reject invalid daily ledgers', () => {
  const { save, references, data } = setup()
  const job = data.quests.find(quest => quest.repeatable)
  const parameters = { sourceId: 'bartender', destinationId: 'worker' }
  save.quests = [...save.quests, { questId: job.id, stageIndex: job.stages.length, parameters }]
  save.courierBoard = { day: save.daytime.day, offeredQuestIds: [job.id], acceptedQuestIds: [job.id], parameters: { [job.id]: parameters } }
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save)), references), save)
  for (const patch of [
    board => { board.day++ },
    board => { board.offeredQuestIds = ['missing'] },
    board => { board.offeredQuestIds = [data.quests.find(quest => !quest.repeatable).id] },
    board => { board.offeredQuestIds.push(job.id) },
    board => { board.offeredQuestIds = data.quests.filter(quest => quest.repeatable).slice(0, 4).map(quest => quest.id) },
    board => { board.acceptedQuestIds.push(job.id) },
    board => { board.acceptedQuestIds = ['missing'] },
  ]) {
    const invalid = structuredClone(save)
    patch(invalid.courierBoard)
    assert.throws(() => validateSave(invalid, references))
  }
})

test('save format round trips and rejects incompatible versions, content, positions, stacks, and progress', () => {
  const { save, references } = setup()
  const parsed = validateSave(JSON.parse(JSON.stringify(save)), references)
  assert.deepEqual(parsed, save)
  assert.notEqual(parsed, save)
  for (const patch of [
    value => { value.version = 2 },
    value => { value.classId = 'missing' },
    value => { value.difficultyId = 'missing' },
    value => { value.inventory.items = [{ itemId: 'missing', quantity: 1 }] },
    value => { value.inventory.items = [{ itemId: 'lockpick', quantity: 4 }] },
    value => { value.inventory.items = Array.from({ length: 7 }, () => ({ itemId: 'rope', quantity: 1 })) },
    value => { value.inventory.money = -1 },
    value => { value.quests[0].stageIndex = 99 },
    value => { value.quests.push(value.quests[0]) },
    value => { value.travel.phaseTravels = 99 },
    value => { value.position.locationId = 'factory' },
    value => { value.position.floor = 99 },
    value => { value.position.roomId = 'missing' },
    value => { value.position.x = NaN },
    value => { delete value.inventory.containers[Object.keys(value.inventory.containers)[0]] },
    value => { value.unlockedDoors = ['3:apartments'] },
    value => { value.unlockedDoors = ['2:missing'] },
  ]) {
    const invalid = structuredClone(save)
    patch(invalid)
    assert.throws(() => validateSave(invalid, references))
  }
})

test('Options saves, loads validated data, restarts without deleting save, and consumes loaded position once', () => {
  const { save, references, position } = setup()
  let raw = null, loaded = null, restarts = 0
  const messages = []
  const storage = { read: () => raw, write: value => { raw = value } }
  const options = new OptionsService(storage, () => save, value => validateSave(value, references),
    value => { loaded = value }, () => { restarts++ }, message => messages.push(message), position)
  options.load()
  assert.match(messages.at(-1), /No saved game/)
  options.save()
  assert.equal(raw, null, 'waits for a stable world position')
  assert.deepEqual(options.takeLoadedPosition(), position)
  assert.equal(options.takeLoadedPosition(), null)
  options.updatePosition(position)
  options.save()
  assert.match(messages.at(-1), /Game saved/)
  options.load()
  assert.deepEqual(loaded, save)
  const stored = raw
  options.restart()
  assert.equal(restarts, 1)
  assert.equal(raw, stored)
  raw = '{bad json'
  loaded = null
  options.load()
  assert.equal(loaded, null)
  assert.match(messages.at(-1), /Unable to load/)
})

test('blocked storage reports errors and does not load or restart the current session', () => {
  const { save, references, position } = setup()
  const messages = []
  let replaced = false
  const options = new OptionsService({ read: () => { throw Error('blocked') }, write: () => { throw Error('full') } },
    () => save, value => validateSave(value, references), () => { replaced = true }, () => { replaced = true }, message => messages.push(message))
  options.updatePosition(position)
  options.save()
  assert.match(messages.at(-1), /Unable to save/)
  options.load()
  assert.match(messages.at(-1), /Unable to load/)
  assert.equal(replaced, false)
})

test('restoring inventory keeps exact loot, locks and player deposits through the next morning', () => {
  const { data } = setup()
  const seeds = [{ id: 'box', name: 'Box', locationId: 'test', locked: false, items: [{ itemId: 'bandage', quantity: 1 }] }]
  const original = new InventoryService(data.items, seeds, () => 0, [{ itemId: 'rope', quantity: 1 }])
  original.grantItems([], 17)
  original.openContainer('box')
  original.storeItem('rope', 0)
  original.takeItem('bandage', 0)
  const saved = original.saveState()
  const restored = new InventoryService(data.items, seeds)
  restored.restoreState(saved)
  assert.deepEqual(restored.saveState(), saved)
  assert.equal(restored.getSnapshot().menu, null)
  restored.refreshContainers()
  assert.deepEqual(restored.getSnapshot().containers.box.items, [{ itemId: 'bandage', quantity: 1 }, { itemId: 'rope', quantity: 1 }])
  assert.equal(restored.getSnapshot().money, 17)
})

test('restored finished quests do not repeat rewards; stats, bus progress, and door unlocks restore', () => {
  const { data, seeds, save } = setup()
  const inventory = new InventoryService(data.items, seeds)
  const quests = new QuestService(data.quests, inventory)
  const before = inventory.getSnapshot()
  const quest = data.quests.find(entry => entry.id === 'bartender-supplies')
  quests.restoreState([{ questId: quest.id, stageIndex: quest.stages.length }])
  assert.equal(quests.advanceDialogue(quest.id, 'bartender', 'deliver-supplies'), false)
  assert.equal(inventory.getSnapshot(), before)
  const status = new StatusService()
  status.restoreState(save.status)
  assert.deepEqual(status.getSnapshot(), save.status)
  const time = new DayTimeService(2, 'evening')
  const travel = new TravelService(data.locations, time)
  travel.restoreState(save.travel)
  travel.openTravel()
  travel.travelTo('center')
  assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 2, phase: 'night' })
  const locks = new LockpickingService(time, () => 0, { lockpickingBaseSeconds: 1, lockpickingSecondsPerPoint: 1 }, { has: () => true, consume: () => true })
  locks.restoreState(save.unlockedDoors)
  assert.equal(locks.isLocked('apartments:apartment-22', 'apartment-22'), false)
  assert.equal(locks.isLocked('apartments:apartment-12', 'apartment-12'), true)
})

test('courier deadlines and failures survive saves', () => {
  const { save, references, data } = setup()
  save.quests = [1,2].map(n => { const q=data.quests.find(q=>q.id==='cashier-'+n); return {questId:q.id,stageIndex:q.stages.length} })
  save.quests.push({questId:'cashier-3',stageIndex:1,deadline:8})
  delete save.inventory.containers['merchant:cashier-deliveries']
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save)),references).quests,save.quests)
  save.quests.at(-1).failed=true
  assert.equal(validateSave(save,references).quests.at(-1).failed,true)
  for(const patch of [q=>{q.deadline=-1},q=>{delete q.deadline},q=>{q.stageIndex=3}]){
    const invalid=structuredClone(save);patch(invalid.quests.at(-1));assert.throws(()=>validateSave(invalid,references))
  }
})

test('parallel handover completion survives saves and rejects invalid objective IDs',()=>{
  const {save,references,data}=setup()
  save.quests=[1,2,3].map(n=>{const q=data.quests.find(q=>q.id==='cashier-'+n);return {questId:q.id,stageIndex:q.stages.length}})
  const q=data.quests.find(q=>q.id==='cashier-4')
  save.quests.push({questId:q.id,stageIndex:1,completedStageIds:[q.stages[2].id],deadline:8})
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save)),references).quests,save.quests)
  for(const ids of [['missing'],[q.stages[0].id],[q.stages[1].id,q.stages[2].id],[q.stages[2].id,q.stages[2].id]]){
    const invalid=structuredClone(save);invalid.quests.at(-1).completedStageIds=ids;assert.throws(()=>validateSave(invalid,references))
  }
})

test('retired courier crates and replacement counter migrate to the single crate without losing deposits',()=>{
  const {save,references}=setup()
  save.inventory.containers['night-courier-bartender-crate']={locked:false,items:[{itemId:'rope',quantity:1}]}
  save.inventory.deposits['night-courier-bartender-crate']=[{itemId:'rope',quantity:1}]
  save.inventory.containers['merchant:cashier-deliveries']={locked:false,items:[{itemId:'bandage',quantity:1}]}
  const migrated=validateSave(save,references)
  assert.ok(migrated.inventory.containers['cashier-5-crate'].items.some(s=>s.itemId==='rope'))
  assert.ok(migrated.inventory.containers['cashier-5-crate'].items.some(s=>s.itemId==='bandage'))
  assert.deepEqual(migrated.inventory.deposits['cashier-5-crate'],[{itemId:'rope',quantity:1}])
  assert.equal(migrated.inventory.containers['night-courier-bartender-crate'],undefined)
  assert.equal(migrated.inventory.containers['merchant:cashier-deliveries'],undefined)
  assert.ok(save.inventory.containers['night-courier-bartender-crate'],'validation does not mutate the input save')
})

test('retired smuggler and Dusan shipment crates merge into district crates with deposits intact', () => {
  const { save, references } = setup()
  const aliases = {
    'smuggler-center-crate': 'cashier-5-crate',
    'dusan-crate-center-crate': 'cashier-5-crate',
    'dusan-crate-living-district-crate': 'smuggler-living-crate',
  }
  for (const id of Object.keys(aliases)) {
    save.inventory.containers[id] = { locked: false, items: [{ itemId: 'bandage', quantity: 1 }] }
    save.inventory.deposits[id] = [{ itemId: 'bandage', quantity: 1 }]
  }
  const migrated = validateSave(save, references)
  for (const [id, target] of Object.entries(aliases)) {
    assert.equal(migrated.inventory.containers[id], undefined)
    assert.equal(migrated.inventory.deposits[id], undefined)
    assert.ok(migrated.inventory.containers[target].items.some(item => item.itemId === 'bandage'))
  }
  assert.deepEqual(migrated.inventory.deposits['cashier-5-crate'], [{ itemId: 'bandage', quantity: 2 }])
  assert.deepEqual(migrated.inventory.deposits['smuggler-living-crate'], [{ itemId: 'bandage', quantity: 1 }])
  assert.ok(save.inventory.containers['smuggler-center-crate'])
})
test('previous tool-slot magazines migrate to carried items during save validation',()=>{
  const {save,references}=setup()
  save.inventory.equipment={tool:'stealth-training-magazine'}
  const previousCount=save.inventory.items.filter(item=>item.itemId==='sport-magazine-stealth').length
  const restored=validateSave(save,references)
  assert.equal(restored.inventory.equipment.tool,undefined)
  assert.equal(restored.inventory.items.filter(item=>item.itemId==='sport-magazine-stealth').length,previousCount+1)
  assert.equal(save.inventory.equipment.tool,'stealth-training-magazine')
})

test('reading records survive validation and reject duplicate, unknown and non-reading identities', () => {
  const { save, references } = setup()
  save.inventory.readBooks = ['health-magazine-medicine', 'chemistry-medicine', 'sci-fi-book']
  assert.deepEqual(validateSave(save, references).inventory.readBooks, save.inventory.readBooks)
  for (const readBooks of [['unknown'], ['bread'], ['sci-fi-book', 'sci-fi-book']]) {
    assert.throws(() => validateSave({ ...save, inventory: { ...save.inventory, readBooks } }, references))
  }
  const legacy = structuredClone(save)
  delete legacy.inventory.readBooks
  assert.deepEqual(validateSave(legacy, references).inventory.readBooks, [])
})

test('old developer safe stock, deposits and reading notes migrate without replenishing taken books', () => {
  const { save, references } = setup()
  const oldSafe = 'living-district:apartments:apartment-51:developer-container'
  const newSafe = 'living-district:apartments:apartment-21:developer-container'
  delete save.inventory.containers[newSafe]
  save.inventory.containers[oldSafe] = { items: [{ itemId: 'leather-journal', quantity: 1 }], locked: false }
  save.inventory.deposits[oldSafe] = [{ itemId: 'leather-journal', quantity: 1 }]
  save.inventory.lootedCaches = [oldSafe]
  save.notes = { locations: [], people: [], items: ['encyclopedia', 'leather-journal'] }
  const migrated = validateSave(save, references)
  assert.deepEqual(migrated.inventory.containers[newSafe].items, [{ itemId: 'chemistry-erudition', quantity: 1 }])
  assert.deepEqual(migrated.inventory.deposits[newSafe], [{ itemId: 'chemistry-erudition', quantity: 1 }])
  assert.deepEqual(migrated.notes.items, ['chemistry-erudition'])
  assert.deepEqual(migrated.inventory.lootedCaches, [newSafe])
  assert.deepEqual(migrated.inventory.readBooks, [])
  assert.deepEqual(validateSave(migrated, references), migrated)
})
test('shoes save alongside armor and old armor-slot footwear migrates',()=>{
 const {save,references}=setup()
 save.inventory.equipment={armor:'work-jacket',shoes:'wool-socks'}
 assert.deepEqual(validateSave(save,references).inventory.equipment,save.inventory.equipment)
 save.inventory.equipment={armor:'leather-boots'}
 assert.deepEqual(validateSave(save,references).inventory.equipment,{shoes:'leather-boots'})
 assert.deepEqual(save.inventory.equipment,{armor:'leather-boots'})
})
test('bottle stack limits migrate old drinks without merging indexed ammunition or losing stored goods',()=>{
 const {save,references}=setup()
 save.inventory.items=[{itemId:'vodka',quantity:3},{itemId:'pistol-ammunition',quantity:5},{itemId:'pistol-ammunition',quantity:1},{itemId:'red-cigarettes',quantity:10}]
 save.inventory.money=0;save.inventory.currencyInInventory=true
 const id=Object.keys(save.inventory.containers)[0]
 save.inventory.containers[id].items=[{itemId:'beer-bottle',quantity:5}]
 const loaded=validateSave(save,references)
 assert.deepEqual(loaded.inventory.items.map(item=>item.quantity),[3,5,1,10])
 assert.deepEqual(loaded.inventory.containers[id].items.map(item=>item.quantity),[3,2])
 assert.equal(save.inventory.items[0].quantity,3)
 save.inventory.items.push(...['letter','rope','cloth'].map(itemId=>({itemId,quantity:1})))
 assert.throws(()=>validateSave(save,references),/incompatible content/)
})
test('generic quest parameters and pending crate return survive saves; invalid destinations and requested items are rejected',()=>{
 const {data,save,references,inventory}=setup()
 const time=new DayTimeService(save.daytime.day,save.daytime.phase),quests=new QuestService(data.quests,inventory,undefined,time,()=>0)
 const finished=[1,2,3,4].map(n=>({questId:`smuggler-${n}`,stageIndex:data.quests.find(q=>q.id===`smuggler-${n}`).stages.length}))
 quests.restoreState(finished)
 quests.acceptFromNpc('smuggler-delivery','citizen-mechanic')
 for(const id of ['courier-delivery','find-item']){quests.openBoard();quests.accept(id)}
 save.inventory=inventory.saveState();save.quests=quests.getSnapshot().progress;save.courierBoard=quests.getSnapshot().courierBoard;save.npcJobs=quests.getSnapshot().npcJobs
 const loaded=validateSave(JSON.parse(JSON.stringify(save)),references)
 assert.deepEqual(loaded,save)
 assert.equal(loaded.quests.filter(q=>q.parameters).length,3)
 for(const patch of [
  value=>{value.quests.find(q=>q.questId==='smuggler-delivery').parameters.sourceId='missing'},
  value=>{value.quests.find(q=>q.questId==='courier-delivery').parameters.destinationId=value.quests.find(q=>q.questId==='courier-delivery').parameters.sourceId},
  value=>{value.quests.find(q=>q.questId==='find-item').parameters.itemId='key-ring'},
  value=>{delete value.courierBoard.parameters['find-item']},
  value=>{value.courierBoard.parameters['find-item'].itemId='service-pistol'},
 ]){const invalid=structuredClone(save);patch(invalid);assert.throws(()=>validateSave(invalid,references))}
})
test('legacy route-specific courier saves migrate into a single parameterized run and shared parcel',()=>{
 const {save,references}=setup();delete save.inventory.deliveryVersion
 save.inventory.items=[{itemId:'courier-worker-parcel',quantity:1}];save.inventory.money=0;save.inventory.currencyInInventory=true
 save.quests=[{questId:'courier-worker',stageIndex:1}]
 save.courierBoard={day:save.daytime.day,offeredQuestIds:['courier-worker','courier-bartender'],acceptedQuestIds:['courier-worker']}
 const loaded=validateSave(save,references)
 assert.deepEqual(loaded.quests,[{questId:'courier-delivery',stageIndex:1,parameters:{sourceId:'worker',destinationId:'cashier'}}])
 assert.deepEqual(loaded.inventory.items,[{itemId:'courier-parcel',quantity:1}])
 assert.equal(loaded.inventory.deliveryVersion,2)
 assert.deepEqual(loaded.courierBoard.offeredQuestIds,['courier-delivery'])
 assert.deepEqual(loaded.courierBoard.parameters['courier-delivery'],loaded.quests[0].parameters)
 assert.equal(save.inventory.items[0].itemId,'courier-worker-parcel')
})

test('legacy escape stages migrate once while current saves retain the opening objective', () => {
  const { save, references } = setup()
  for (const stageIndex of [0, 1, 2]) {
    const legacy = structuredClone(save)
    delete legacy.openingVersion
    delete legacy.escapeCluesVersion
    legacy.quests = [{ questId: 'way-out-of-town', stageIndex }]
    const migrated = validateSave(legacy, references)
    assert.equal(migrated.quests[0].stageIndex, [1, 4, 5][stageIndex])
    assert.deepEqual(validateSave(migrated, references), migrated)
    assert.equal(legacy.quests[0].stageIndex, stageIndex)
  }
  save.quests = [{ questId: 'way-out-of-town', stageIndex: 0 }]
  assert.equal(validateSave(save, references).quests[0].stageIndex, 0)
})

test('older saves initialize Nadia barter while preserving existing containers and purchases', () => {
  const { save, references, seeds, data } = setup()
  delete save.inventory.containers['merchant:citizen-nurse']
  const existing = structuredClone(save.inventory.containers)
  const validated = validateSave(save, references)
  const inventory = new InventoryService(data.items, seeds, () => 0)
  inventory.restoreState(validated.inventory)
  assert.ok(inventory.getSnapshot().containers['merchant:citizen-nurse'].items.some(item => item.itemId === 'bandage'))
  const restored = inventory.saveState().containers
  delete restored['merchant:citizen-nurse']
  assert.deepEqual(restored, existing)
})

test('statistics are optional in old saves and reject invalid totals', () => {
  const { save, references } = setup()
  const statistics = { distance: 123.5, alcoholDrunk: 2, moneySpent: 10 }
  assert.deepEqual(validateSave({ ...save, statistics }, references).statistics, statistics)
  for (const value of [-1, Infinity, NaN, '2', 0.5]) {
    assert.throws(() => validateSave({ ...save, statistics: { moneySpent: value } }, references))
  }
})

test('statistics reject unknown counters while preserving fractional damage and old saves', () => {
  const { save, references } = setup()
  assert.throws(() => validateSave({ ...save, statistics: { typoCounter: 1 } }, references))
  const statistics = { damageDealt: 1.5, damageTaken: 0.25, monstersKilled: 2 }
  assert.deepEqual(validateSave({ ...save, statistics }, references).statistics, statistics)
  assert.equal(validateSave(save, references).statistics, undefined)
})
