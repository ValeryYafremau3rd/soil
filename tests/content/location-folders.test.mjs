import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { contentFiles } from '../helpers/content.mjs'

test('building and room placements follow their parents and inherit scale', () => {
  const files = contentFiles()
  const buildingPath = './locations/center/buildings/center-bar/index.json'
  const building = files[buildingPath]
  const definition = files['./buildings/bar.json']
  definition.rooms = [{ id: 'test-room', type: 'unused', x: 50, floor: 0 }]
  const folder = './locations/center/buildings/center-bar/'
  files[`${folder}rooms/test-room/containers.json`] = [{ id: 'test-box', type: 'crate', x: 20, heightOffset: 5 }]
  files[`${folder}furniture.json`] = [{ id: 'test-chair', type: 'chair', x: 30, floor: 0, scale: 0.5 }]
  files[`${folder}taskboards.json`] = [{ id: 'test-board', type: 'wall', x: 40, floor: 0 }]
  const first = assembleContent(files).data
  const box = first.containers.placements.find(p => p.id === 'test-box')
  const scale = definition.scale * building.scale
  assert.equal(box.x, building.entranceX + (70 - definition.entranceX) * scale)
  assert.equal(box.heightOffset, 5 * scale)
  assert.equal(box.scale, scale)
  assert.equal(box.roomId, 'test-room')
  building.entranceX += 100
  const second = assembleContent(files).data
  for (const field of ['containers', 'furniture', 'taskboards']) {
    for (const piece of first[field].placements.filter(p => p.buildingId === building.id)) {
      const moved = second[field].placements.find(p => p.id === piece.id)
      assert.ok(Math.abs(moved.x - piece.x - 100) < 1e-8)
    }
  }
  assert.deepEqual(second.containers.placements.filter(p => !p.buildingId), first.containers.placements.filter(p => !p.buildingId))
  assert.deepEqual(assembleContent(files).data, second)
  definition.rooms[0].x += 25
  const movedRoom = assembleContent(files).data
  assert.ok(Math.abs(movedRoom.containers.placements.find(p => p.id === 'test-box').x - box.x - 100 - 25 * scale) < 1e-8)
  assert.deepEqual(movedRoom.furniture, second.furniture)
  building.scale *= 2
  const resized = assembleContent(files).data
  const resizedBox = resized.containers.placements.find(p => p.id === 'test-box')
  assert.equal(resizedBox.x, building.entranceX + (95 - definition.entranceX) * scale * 2)
  assert.equal(resizedBox.heightOffset, box.heightOffset * 2)
  assert.equal(resizedBox.scale, box.scale * 2)
  assert.equal(resized.furniture.placements.find(p => p.id === 'test-chair').scale, scale)
})

test('malformed legacy building lists reach schema validation with their source path', () => {
  for (const buildings of [undefined, null, {}]) {
    const files = contentFiles()
    const { data } = assembleContent(files)
    for (const path of Object.keys(files)) if (path.startsWith('./locations/')) delete files[path]
    for (const location of data.locations) files[`./locations/${location.id}.json`] = { ...location }
    files['./locations/center.json'].buildings = buildings
    const catalogue = assembleContent(files)
    assert.throws(() => validateContent(catalogue.data, catalogue.sources), /locations\/center.json.buildings: expected array/)
  }
})

test('folder errors identify the authored file and reject conflicting ownership', () => {
  const path = './locations/center/buildings/center-bar/containers.json'
  for (const patch of [{ buildingId: 'other' }, { x: 'bad' }, { scale: -1 }]) {
    const files = contentFiles()
    files[path] = [{ id: 'test', type: 'crate', x: 10, ...patch }]
    assert.throws(() => assembleContent(files), /center-bar\/containers.json\[0\]/)
  }
  const files = contentFiles()
  files[path] = [{ id: 'test', type: 'missing', x: 400 }]
  const { data, sources } = assembleContent(files)
  assert.throws(() => validateContent(data, sources), /center-bar\/containers.json\[0\].type/)
  files['./locations/center/typo.json'] = []
  assert.throws(() => assembleContent(files), /typo.json: unrecognized/)
})
