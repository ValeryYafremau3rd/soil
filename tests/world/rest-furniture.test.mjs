import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { DAY_PHASES } from '../../src/app/contracts/daytime.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, content } from '../helpers/content.mjs'

test('rest advances one phase only after confirmation; cancel and duplicate confirm do not change time', () => {
  const time = new DayTimeService(), rest = new RestService(time)
  const initial = time.getSnapshot()
  rest.open('rest', 'Bench')
  assert.equal(time.getSnapshot(), initial)
  rest.close()
  rest.confirm()
  assert.equal(time.getSnapshot(), initial)
  rest.open('rest', 'Chair')
  rest.confirm()
  assert.deepEqual(time.getSnapshot(), { day: 1, phase: 'afternoon' })
  assert.equal(rest.getSnapshot().menu, null)
  rest.confirm()
  assert.equal(time.getSnapshot().phase, 'afternoon')
})

test('beds and sofas skip to the next morning from every phase with a single time notification', () => {
  const { types } = content().furniture
  for (const type of ['bed', 'sofa']) {
    const definition = types[type]
    assert.equal(definition.action, 'sleep')
    for (const phase of DAY_PHASES) {
      const time = new DayTimeService(3, phase), rest = new RestService(time)
      let notifications = 0
      time.subscribe(() => notifications++)
      rest.open(definition.action, definition.name)
      rest.confirm()
      assert.deepEqual(time.getSnapshot(), { day: 4, phase: 'morning' })
      assert.equal(notifications, 1)
    }
  }
})

test('rest subscriptions are stable and can be released', () => {
  const rest = new RestService(new DayTimeService())
  let notifications = 0
  const unsubscribe = rest.subscribe(() => notifications++)
  rest.close()
  rest.open('rest', 'Bench')
  rest.open('sleep', 'Bed')
  assert.equal(rest.getSnapshot().menu.name, 'Bench')
  assert.equal(notifications, 1)
  unsubscribe()
  rest.close()
  assert.equal(notifications, 1)
})

test('authored street furniture and room furniture reference fitting sprite crops', () => {
  const data = content()
  validateContent(data)
  for (const definition of Object.values(data.furniture.types)) {
    const png = readFileSync(new URL(`../../public/${definition.path}`, import.meta.url))
    const ratio = png.readUInt32BE(16) / definition.referenceWidth
    assert.ok((definition.crop.x + definition.crop.width) * ratio <= png.readUInt32BE(16))
    assert.ok((definition.crop.y + definition.crop.height) * ratio <= png.readUInt32BE(20))
  }
  for (const location of data.locations) {
    const placed = data.furniture.placements.filter(p => p.locationId === location.id)
    assert.ok(placed.some(p => data.furniture.types[p.type].action === 'rest'))
    assert.ok(placed.some(p => data.furniture.types[p.type].action === 'hide'))
  }
  const pieces = Object.values(data.rooms).flatMap(room => room.furniture ?? [])
  assert.ok(pieces.some(p => p.type === 'chair'))
  assert.ok(pieces.some(p => p.type === 'bed'))
  assert.ok(pieces.some(p => p.type === 'sofa'))
})

test('furniture atlas crops isolate each object without including another configured sprite', () => {
  const definitions = Object.entries(content().furniture.types)
  for (let i = 0; i < definitions.length; i++) {
    const [id, definition] = definitions[i]
    for (const [otherId, other] of definitions.slice(i + 1)) {
      if (definition.path !== other.path) continue
      const a = definition.crop, b = other.crop
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height
      assert.equal(overlap, false, `${id} includes part of ${otherId}`)
    }
  }
})

test('rest furniture is placed and districts have three to five evenly scattered hiding spots', () => {
  const data = content()
  const placed = new Set(data.furniture.placements.filter(p => p.enabled !== false).map(p => p.type))
  for (const room of Object.values(data.rooms)) {
    for (const piece of room.furniture ?? []) {
      placed.add(piece.type)
    }
  }
  for (const [id, type] of Object.entries(data.furniture.types)) {
    if (type.action !== 'hide' && !id.startsWith('bench')) assert.ok(placed.has(id), id)
  }
  for (const location of data.locations) {
    assert.equal(data.furniture.placements.filter(p => p.enabled !== false && p.locationId === location.id
      && p.space === 'outside' && p.type.startsWith('bench')).length, 1, `${location.id}: one street bench`)
    const cover = data.furniture.placements.filter(p => p.enabled !== false && p.locationId === location.id
      && p.space === 'outside' && data.furniture.types[p.type].action === 'hide').sort((a, b) => a.x - b.x)
    assert.ok(cover.length >= 3 && cover.length <= 5, location.id)
    const png = readFileSync(new URL(`../../public/${location.background.path}`, import.meta.url))
    const width = png.readUInt32BE(16) / png.readUInt32BE(20) * location.background.height * (location.background.scale ?? 1)
    assert.ok(cover[0].x <= width * 0.15, `${location.id}: west approach needs cover`)
    assert.ok(width - cover.at(-1).x <= width * 0.15, `${location.id}: east approach needs cover`)
    for (let i = 1; i < cover.length; i++) {
      assert.ok(cover[i].x - cover[i - 1].x >= 300, `${location.id}: cover is clustered`)
      assert.ok(cover[i].x - cover[i - 1].x <= width * 0.25, `${location.id}: cover gap is too large`)
    }
  }
})

test('furniture configuration rejects unknown types, outdoor beds and room props outside their room', () => {
  const cases = [
    [data => { data.furniture.placements[0].type = 'missing' }, /unknown ID/],
    [data => { data.furniture.placements[0].type = 'bed' }, /beds belong indoors/],
    [data => { data.rooms['house-11'].furniture[0].x = 9999 }, /rooms\/house-11.json.*outside room bounds/],
    [data => { data.rooms['house-11'].furniture[0].type = 'cover-crate' }, /cover belongs outdoors/],
    [data => { delete data.furniture.types['cover-crate'].revealPrompt }, /revealPrompt: required/],
  ]
  for (const [mutate, pattern] of cases) {
    const { data, sources } = catalogue()
    mutate(data)
    assert.throws(() => validateContent(data, sources), pattern)
  }
})
