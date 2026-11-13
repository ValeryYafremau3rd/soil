import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { locationFiles } from '../../src/app/content/locationFiles.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { PlacedObjectManager } from '../../src/game/interactive/PlacedObjectManager.ts'
import { HudService } from '../../src/app/services/HudService.ts'
import { catalogue, contentFiles as authoredFiles } from '../helpers/content.mjs'

function contentFiles() { return locationFiles(authoredFiles(), new Map()) }

test('locations own taskboard placements with reusable street and wall definitions', () => {
  const files = contentFiles()
  const { data, sources } = assembleContent(files)
  validateContent(data, sources)
  for (const location of data.locations) {
    const authored = files[`./locations/${location.id}.json`].taskboards ?? []
    const placed = data.taskboards.placements.filter(board => board.locationId === location.id)
    assert.deepEqual(placed, authored.map(board => ({ ...board, locationId: location.id })))
    for (const board of placed) assert.equal(board.space, data.taskboards.types[board.type].space)
  }
})

test('taskboards are optional, can be disabled, and new definition files are discovered', () => {
  const files = contentFiles()
  delete files['./locations/factory.json'].taskboards
  files['./taskboards/noticeboard.json'] = structuredClone(files['./taskboards/street.json'])
  files['./locations/center.json'].taskboards[0].type = 'noticeboard'
  files['./locations/center.json'].taskboards[0].enabled = false
  const { data, sources } = assembleContent(files)
  validateContent(data, sources)
  assert.equal(data.taskboards.placements.some(board => board.locationId === 'factory'), false)
  assert.ok(data.taskboards.types.noticeboard)
})

test('taskboard errors identify the authored location and reject wrong bindings and sizes', () => {
  const cases = [
    [board => { board.type = 'missing' }, /type: unknown ID/],
    [board => { board.space = 'outside' }, /space: does not match/],
    [board => { board.buildingId = 'missing' }, /buildingId: unknown building instance/],
    [board => { board.floor = 99 }, /floor: floor does not exist/],
    [board => { board.x = 0 }, /x: outside the walkable floor/],
    [board => { board.scale = 0 }, /scale: expected/],
    [board => { board.heightOffset = 900 }, /heightOffset: taskboard does not fit/],
  ]
  for (const [mutate, message] of cases) {
    const files = contentFiles()
    mutate(files['./locations/living-district.json'].taskboards[1])
    const { data, sources } = assembleContent(files)
    assert.throws(() => validateContent(data, sources), error => {
      assert.match(error.message, /src\/content\/locations\/living-district.json.taskboards\[1\]/)
      assert.match(error.message, message)
      return true
    })
  }
})

test('taskboard definitions reject unknown menus and invalid silhouettes', () => {
  const input = catalogue().data
  input.taskboards.types.street.menuId = 'missing'
  assert.throws(() => validateContent(input), /menuId: unknown HUD menu/)
  input.taskboards.types.street.menuId = 'quests'
  input.taskboards.types.street.outline[0].x = 9999
  assert.throws(() => validateContent(input), /outline: expected at least three points within the crop/)
})

function object(id, x, space, buildingId) {
  return {
    placement: { id, space, buildingId }, sprite: { x, visible: true }, enabled: false,
    setVisible(visible) { this.sprite.visible = visible },
    canInteractWith() { return this.sprite.visible },
    update(_hero, actions, enabled) { this.enabled = enabled; return enabled && actions.interactPressed },
  }
}

test('placed props hide outdoors or in other interiors and all nearby options remain selectable', () => {
  const street = object('street', 10, 'outside')
  const room = object('room', 20, 'inside', 'apartments')
  const otherRoom = object('other-room', 25, 'inside', 'shop')
  const secondStreet = object('second-street', 80, 'outside')
  const manager = new PlacedObjectManager([street, room, otherRoom, secondStreet])
  assert.deepEqual([street, room, otherRoom].map(board => board.sprite.visible), [true, false, false])
  assert.equal(manager.update({ sprite: { x: 12 } }, { interactPressed: true }), true)
  assert.deepEqual([street, room, otherRoom, secondStreet].map(board => board.enabled), [true, false, false, true])
  manager.setInside('apartments')
  assert.deepEqual([street, room, otherRoom].map(board => board.sprite.visible), [false, true, false])
  manager.update({ sprite: { x: 12 } }, { interactPressed: true })
  assert.equal(room.enabled, true)
  assert.equal(street.enabled, false)
  manager.setInside()
  assert.equal(street.sprite.visible, true)
  assert.equal(room.sprite.visible, false)
  assert.equal(manager.canInteractWith({ sprite: { x: 12 } }), true)
  assert.equal(manager.update({ sprite: { x: 12 } }, { interactPressed: true }, false), false)
  assert.ok([street, room, otherRoom, secondStreet].every(board => !board.enabled))
})

test('boards target the existing quests modal without populating quests', () => {
  const input = catalogue().data
  const hud = new HudService(input.ui.menus.map(menu => menu.id))
  for (const definition of Object.values(input.taskboards.types)) {
    hud.openMenu(definition.menuId)
    assert.equal(hud.getSnapshot().menuId, 'quests')
    hud.closeMenu()
    assert.equal(hud.getSnapshot().menuId, null)
  }
})
