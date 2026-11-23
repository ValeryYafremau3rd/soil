import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { content } from '../helpers/content.mjs'
import test from 'node:test'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('skill attribute weights reject misspelled attributes, missing skills, negative weights and inconsistent scales', () => {
  for (const mutate of [
    input => { input.skills.attributeWeights.weapons.focus = 2 },
    input => { delete input.skills.attributeWeights.medicine },
    input => { input.skills.attributeWeights.stealth.agility = -1 },
    input => { input.skills.attributeWeights.stealth.agility = 1.5 },
    input => { input.skills.attributeWeights.barter.charisma = 3 },
  ]) {
    const input = content()
    mutate(input)
    assert.throws(() => validateContent(input), /skills.json.attributeWeights/)
  }
})

test('the complete shipped JSON configuration is valid and all referenced PNG files exist', () => {
  const input = content()
  validateContent(input)
  const paths = [input.hero.asset.path, input.settings.busStop.path, input.containers.sheet.path,
    ...Object.values(input.containers.types).flatMap(type => type.sheet ? [type.sheet.path] : []),
    input.ui.itemSheet.path, input.daytime.iconSheet.path, ...input.locations.map(location => location.background.path),
    ...Object.values(input.buildings).flatMap(building => building.sprites.map(sprite => sprite.path)),
    ...Object.values(input.npcs).map(npc => npc.path), ...Object.values(input.taskboards.types).map(board => board.path),
    ...Object.values(input.patrols.types).map(patrol => patrol.path), ...Object.values(input.rooms).map(room => room.sprite.path),
    ...Object.values(input.furniture.types).map(object => object.path)]
  for (const path of paths) assert.ok(existsSync(new URL(`../../public/${path}`, import.meta.url)), path)
})

test('unknown items in manual containers report the container ID and item ID', () => {
  const input = content()
  input.containers.placements.find(placement => placement.id === 'living-trash').items = [{ itemId: 'missing-item', quantity: 1 }]
  assert.throws(() => validateContent(input), /living-trash.*unknown item ID "missing-item"/)
})

test('manual-only container content is supported without a loot table', () => {
  const input = content()
  delete input.containers.placements[0].lootTable
  input.containers.placements[0].items = [{ itemId: 'bandage', quantity: 3 }]
  assert.doesNotThrow(() => validateContent(input))
})

test('invalid quantities and zero or negative scales fail with the JSON path', () => {
  const cases = [
    [input => { input.items[0].scale = 0 }, /items.json\[0\].scale/],
    [input => { input.npcs.stranger.scale = -1 }, /npcs.json.stranger.scale/],
    [input => { input.locations[0].buildings[0].scale = 0 }, /locations.json\[0\].buildings\[0\].scale/],
    [input => { input.containers.placements[0].items = [{ itemId: 'bread', quantity: 0 }] }, /quantity/],
    [input => { input.containers.placements[0].heightOffset = -1 }, /heightOffset/],
  ]
  for (const [mutate, message] of cases) { const input = content(); mutate(input); assert.throws(() => validateContent(input), message) }
})

test('unknown buildings, dialogue IDs, and dialogue links fail before starting the game', () => {
  let input = content()
  input.locations[0].buildings[0].type = 'missing-building'
  assert.throws(() => validateContent(input), /unknown ID "missing-building"/)
  input = content()
  input.npcs.worker.dialogueId = 'missing-dialogue'
  assert.throws(() => validateContent(input), /unknown ID "missing-dialogue"/)
  input = content()
  input.dialogues.stranger.nodes.greeting.choices[0].next = 'missing-node'
  assert.throws(() => validateContent(input), /unknown ID "missing-node"/)
})

test('NPC dialogue is optional and placements can be disabled in JSON', () => {
  const input = content()
  input.npcs['idle-worker'] = { ...input.npcs.worker }
  delete input.npcs['idle-worker'].dialogueId
  delete input.npcs['idle-worker'].schedule
  input.locations.find(location => location.id === 'factory').npc.enabled = false
  input.locations[2].buildings[0].enabled = false
  input.containers.placements[0].enabled = false
  assert.doesNotThrow(() => validateContent(input))
})

test('indoor containers must reference a real building, floor, and walkable position', () => {
  let input = content()
  input.containers.placements.find(placement => placement.space === 'inside').buildingId = 'missing-room'
  assert.throws(() => validateContent(input), /buildingId: unknown building instance/)
  input = content()
  input.containers.placements.find(placement => placement.space === 'inside').floor = 99
  assert.throws(() => validateContent(input), /floor: floor does not exist/)
  input = content()
  input.containers.placements.find(placement => placement.space === 'inside').x = 0
  assert.throws(() => validateContent(input), /outside the walkable floor/)
})

test('loot ranges and optional pool IDs are validated', () => {
  let input = content()
  input.containers.lootTables.scavenge.minItems = 4
  assert.throws(() => validateContent(input), /impossible item count/)
  input = content()
  input.containers.lootTables.scavenge.itemIds = ['missing-item']
  assert.throws(() => validateContent(input), /unknown item ID/)
})

test('typos in optional configuration fields are rejected rather than ignored', () => {
  const input = content()
  input.npcs.stranger.sacle = 2
  assert.throws(() => validateContent(input), /sacle: unknown configuration field/)
})

test('standable surfaces reject reversed bounds and positions outside their sprite', () => {
  let input = content()
  input.containers.types.safe.platform.left = 0.99
  assert.throws(() => validateContent(input), /left must be less than right/)
  input = content()
  input.containers.types.safe.platform.top = 1.1
  assert.throws(() => validateContent(input), /platform.top/)
})
