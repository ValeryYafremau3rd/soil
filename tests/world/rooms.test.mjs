import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nearestRoomDoor } from '../../src/domain/buildings/rooms.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, content } from '../helpers/content.mjs'

test('room doors require the same floor and horizontal/vertical proximity', () => {
  const doors = [{ id: '11', floor: 0, x: 100, y: 500 }, { id: '21', floor: 1, x: 100, y: 350 },
    { id: '12', floor: 0, x: 300, y: 500 }]
  assert.equal(nearestRoomDoor(doors, 0, { x: 110, y: 500 }, 25)?.id, '11')
  assert.equal(nearestRoomDoor(doors, 1, { x: 110, y: 350 }, 25)?.id, '21')
  assert.equal(nearestRoomDoor(doors, 0, { x: 110, y: 350 }, 25), undefined)
  assert.equal(nearestRoomDoor(doors, 0, { x: 126, y: 500 }, 25), undefined)
  assert.equal(nearestRoomDoor(doors, 0, { x: 110, y: 474 }, 25), undefined)
})

test('overlapping door ranges choose the nearest door', () => {
  const doors = [{ id: 'left', floor: 0, x: 100, y: 500 }, { id: 'right', floor: 0, x: 130, y: 500 }]
  assert.equal(nearestRoomDoor(doors, 0, { x: 123, y: 500 }, 25)?.id, 'right')
})

test('house rooms use separate crops and bind to reachable doors on every floor', () => {
  const data = content()
  validateContent(data)
  const house = data.buildings.house
  assert.equal(house.rooms.length, house.inner.floors.length * 2)
  assert.equal(new Set(house.rooms.map(room => room.id)).size, house.rooms.length)
  for (const binding of house.rooms) {
    const room = data.rooms[binding.type]
    const png = readFileSync(new URL(`../../public/${room.sprite.path}`, import.meta.url))
    const ratio = png.readUInt32BE(16) / room.sprite.referenceWidth
    const crop = room.sprite.crop
    assert.ok((crop.x + crop.width) * ratio <= png.readUInt32BE(16))
    assert.ok((crop.y + crop.height) * ratio <= png.readUInt32BE(20))
    assert.ok(binding.doorX > house.inner.floors[binding.floor].left)
    assert.ok(binding.doorX < house.inner.floors[binding.floor].right)
  }
})

test('factory uses only its replacement exterior/interior sheet without separate rooms', () => {
  const data = content()
  validateContent(data)
  const factory = data.buildings.factory
  assert.equal(factory.rooms, undefined)
  assert.equal(factory.entrances.length, 2)
  assert.ok(factory.sprites.every(sprite => sprite.path === 'assets/buildings/factory.png'))
  assert.ok(!Object.keys(data.rooms).some(id => id.startsWith('factory-')))
})

test('rooms are optional for buildings without room doors', () => {
  const data = content()
  const roomContainers = new Set(data.containers.placements.filter(placement => placement.roomId).map(placement => placement.id))
  const removed = new Set(data.quests.filter(quest => quest.stages.some(stage => stage.trigger.kind === 'loot' && roomContainers.has(stage.trigger.containerId))).map(quest => quest.id))
  data.containers.placements = data.containers.placements.filter(placement => !placement.roomId)
  data.quests = data.quests.filter(quest => !removed.has(quest.id))
  for (const dialogue of Object.values(data.dialogues)) for (const node of Object.values(dialogue.nodes)) {
    node.choices = node.choices.filter(choice => !removed.has(choice.acceptQuestId) && !removed.has(choice.questId))
  }
  delete data.buildings.house.rooms
  for (const item of data.items) if (item.keys) item.keys = item.keys.filter(key => !key.doorId.includes(':'))
  for (const location of data.locations) delete location.initialSpawn
  for (const npc of Object.values(data.npcs)) for (const [phase, placement] of Object.entries(npc.schedule ?? {})) {
    if (placement.roomId) delete npc.schedule[phase]
  }
  assert.doesNotThrow(() => validateContent(data))
})

test('new games start at the Factory bus stop and optional starting rooms are validated', () => {
  const data = content()
  assert.equal(data.locations[0].id, 'factory')
  assert.equal(data.locations[0].initialSpawn, undefined)
  for (const [patch, pattern] of [
    [{ buildingId: 'missing' }, /initialSpawn.buildingId: unknown or disabled building/],
    [{ roomId: 'missing' }, /initialSpawn.roomId: unknown room/],
    [{ x: 9999 }, /initialSpawn.x: outside the walkable room/],
  ]) {
    const { data, sources } = catalogue()
    data.locations.find(location => location.id === 'living-district').initialSpawn = { buildingId: 'apartments', roomId: 'apartment-21', x: 150, ...patch }
    assert.throws(() => validateContent(data, sources), pattern)
  }
})

test('room references, floors, bounds and door positions fail with authored file diagnostics', () => {
  const cases = [
    [data => { data.buildings.house.rooms[0].type = 'missing' }, /buildings\/house.json.rooms.*type: unknown ID/],
    [data => { data.buildings.house.rooms[0].floor = 99 }, /floor: floor does not exist/],
    [data => { data.buildings.house.rooms[0].doorX = 700 }, /doorX: door is outside/],
    [data => { data.buildings.house.rooms[0].x = 3000 }, /x: room lies outside/],
    [data => { data.rooms['house-11'].bounds.right = 9999 }, /rooms\/house-11.json.*boundaries exceed/],
    [data => { data.rooms['house-11'].widthScale = 0 }, /rooms\/house-11.json.widthScale/],
    [data => { delete data.rooms['house-11'].widthScale }, /rooms\/house-11.json.*boundaries exceed/],
    [data => { data.buildings.house.rooms[1].id = data.buildings.house.rooms[0].id }, /rooms: IDs must be unique/],
  ]
  for (const [mutate, pattern] of cases) {
    const { data, sources } = catalogue()
    mutate(data)
    assert.throws(() => validateContent(data, sources), pattern)
  }
})
