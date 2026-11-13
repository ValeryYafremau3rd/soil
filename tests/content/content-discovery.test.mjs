import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { locationFiles } from '../../src/app/content/locationFiles.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, contentFiles as authoredFiles } from '../helpers/content.mjs'

// Keep exercising compatibility with flat location documents.
function contentFiles() { return locationFiles(authoredFiles(), new Map()) }

test('new definition files and locations are discovered without registry changes', () => {
  const files = contentFiles()
  files['./buildings/warehouse.json'] = structuredClone(files['./buildings/factory.json'])
  files['./npcs/guard.json'] = structuredClone(files['./npcs/worker.json'])
  files['./items/new-item.json'] = { ...files['./items/bandage.json'], id: 'new-item' }
  files['./containers/types/box.json'] = structuredClone(files['./containers/types/crate.json'])
  files['./loot-tables/supplies.json'] = { minItems: 1, maxItems: 1, itemIds: ['new-item'] }
  files['./locations/warehouse.json'] = {
    ...structuredClone(files['./locations/factory.json']), id: 'warehouse', order: 3,
    connections: {},
    buildings: [{ id: 'warehouse-main', type: 'warehouse', entranceX: 1296 }],
    npc: { type: 'guard', x: 1196 },
    containers: [{ id: 'warehouse-box', type: 'box', x: 620, space: 'outside', lootTable: 'supplies' }],
    taskboards: [],
    furniture: [],
  }
  const { data, sources } = assembleContent(files)
  validateContent(data, sources)
  assert.equal(data.locations.at(-1).id, 'warehouse')
  assert.equal(data.containers.placements.at(-1).locationId, 'warehouse')
  assert.ok(data.items.some(item => item.id === 'new-item'))
})

test('container placement ownership is inherited and authored values are preserved', () => {
  const files = contentFiles()
  const { data } = assembleContent(files)
  for (const location of data.locations) {
    const authored = files[`./locations/${location.id}.json`].containers
    assert.deepEqual(data.containers.placements.filter(p => p.locationId === location.id),
      authored.map(placement => ({ ...placement, locationId: location.id })))
    assert.equal('containers' in location, false)
  }
  assert.deepEqual(data.locations.map(location => location.id), ['center', 'factory', 'living-district'])
})

test('a location can omit containers and manual loot needs no random table', () => {
  const files = contentFiles()
  delete files['./locations/factory.json'].containers
  delete files['./locations/center.json'].containers
  files['./locations/living-district.json'].containers = [{
    id: 'manual-box', type: 'crate', x: 620, space: 'outside', items: [{ itemId: 'bandage', quantity: 3 }],
  }]
  const removed = new Set()
  for (const [path, quest] of Object.entries(files)) {
    if (path.startsWith('./quests/') && quest.stages.some(stage => stage.trigger.kind === 'loot')) {
      removed.add(quest.id)
      delete files[path]
    }
  }
  let removedDependent = true
  while (removedDependent) {
    removedDependent = false
    for (const [path, quest] of Object.entries(files)) if (path.startsWith('./quests/') && quest.prerequisites?.some(id => removed.has(id))) {
      removed.add(quest.id); delete files[path]; removedDependent = true
    }
  }
  const remainingOfferers = new Set(Object.entries(files)
    .filter(([path]) => path.startsWith('./quests/')).map(([, quest]) => quest.offeredBy))
  for (const [path, quest] of Object.entries(files)) if (path.startsWith('./quests/')) {
    quest.stages = quest.stages.filter(stage => stage.trigger.kind !== 'questAccepted' || remainingOfferers.has(stage.trigger.npcId))
  }
  for (const [path, dialogue] of Object.entries(files)) if (path.startsWith('./dialogues/')) {
    for (const node of Object.values(dialogue.nodes)) node.choices = node.choices.filter(choice => !removed.has(choice.acceptQuestId) && !removed.has(choice.questId))
  }
  const { data, sources } = assembleContent(files)
  validateContent(data, sources)
  assert.equal(data.containers.placements.length, 1)
  assert.deepEqual(data.containers.placements[0].items, [{ itemId: 'bandage', quantity: 3 }])
})

test('location, placement, definition and loot errors identify their authored file', () => {
  const cases = [
    [files => { files['./locations/living-district.json'].containers[0].scale = 0 }, /locations\/living-district.json.containers\[0\].scale/],
    [files => { files['./locations/living-district.json'].containers[0].type = 'missing' }, /locations\/living-district.json.containers\[0\].type.*unknown ID/],
    [files => { files['./locations/living-district.json'].containers[0].items = [{ itemId: 'missing', quantity: 1 }] }, /locations\/living-district.json.containers\[0\].items.*unknown item/],
    [files => { files['./buildings/house.json'].scale = 0 }, /buildings\/house.json.scale/],
    [files => { files['./npcs/worker.json'].dialogueId = 'missing' }, /npcs\/worker.json.dialogueId/],
    [files => { files['./loot-tables/scavenge.json'].minItems = 9 }, /loot-tables\/scavenge.json.*impossible/],
    [files => { files['./items/bandage.json'].icon.x = 9999 }, /items\/bandage.json.icon/],
  ]
  for (const [mutate, pattern] of cases) {
    const files = contentFiles()
    mutate(files)
    const { data, sources } = assembleContent(files)
    assert.throws(() => validateContent(data, sources), pattern)
  }
})

test('conflicting ownership, malformed placement lists and filename IDs are rejected', () => {
  const cases = [
    [files => { files['./locations/living-district.json'].containers[0].locationId = 'factory' }, /locationId is inherited/],
    [files => { files['./locations/living-district.json'].containers = {} }, /living-district.json.containers: expected an array/],
    [files => { files['./locations/living-district.json'].containers = [null] }, /containers\[0\]: expected an object/],
    [files => { files['./items/bandage.json'].id = 'other' }, /items\/bandage.json: id must match/],
  ]
  for (const [mutate, pattern] of cases) {
    const files = contentFiles()
    mutate(files)
    assert.throws(() => assembleContent(files), pattern)
  }
})

test('container IDs remain unique across locations', () => {
  const { data, sources } = catalogue()
  data.containers.placements[4].id = data.containers.placements[0].id
  assert.throws(() => validateContent(data, sources), /IDs must be unique/)
})
