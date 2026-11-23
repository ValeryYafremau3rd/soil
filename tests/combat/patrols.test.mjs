import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Wanderer } from '../../src/domain/npcs/Wanderer.ts'
import { DAY_PHASES } from '../../src/app/contracts/daytime.ts'
import { resolvePatrolPopulation } from '../../src/app/content/resolvePatrolPopulation.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, content } from '../helpers/content.mjs'
import { keepLargestComponent } from '../../src/game/rendering/keepLargestComponent.ts'

const movement = { speed: 100, minWalkMs: 1000, maxWalkMs: 1000, minPauseMs: 500, maxPauseMs: 500 }

test('sprite cleanup removes isolated specks while preserving dark clothing and diagonal detail', () => {
  const pixels = new Uint8ClampedArray(6 * 6 * 4)
  for (const index of [0, 7, 8, 14, 15, 35]) pixels.set([7, 5, 7, 255], index * 4)
  keepLargestComponent(pixels, 6, 6)
  for (const index of [0, 7, 8, 14, 15]) assert.equal(pixels[index * 4 + 3], 255)
  assert.equal(pixels[35 * 4 + 3], 0)
  assert.deepEqual(Array.from(pixels.slice(0, 3)), [7, 5, 7])
})

test('sprite cleanup handles fully transparent frames', () => {
  const pixels = new Uint8ClampedArray(16)
  keepLargestComponent(pixels, 2, 2)
  assert.ok(pixels.every(value => value === 0))
})

test('patrols alternate walking and standing without drifting while stopped', () => {
  const patrol = new Wanderer(50, { left: 0, right: 1000 }, movement, () => 0.75)
  patrol.update(250)
  assert.equal(patrol.x, 75)
  patrol.update(750)
  assert.equal(patrol.x, 150)
  assert.equal(patrol.walking, false)
  patrol.update(250)
  assert.equal(patrol.x, 150)
  patrol.update(250)
  assert.equal(patrol.walking, true)
  patrol.update(100)
  assert.equal(patrol.x, 160)
})

test('patrols stop and turn at both bounds without leaving the location', () => {
  for (const [start, random, edge, direction] of [[95, 0.75, 100, -1], [5, 0.25, 0, 1]]) {
    const patrol = new Wanderer(start, { left: 0, right: 100 }, movement, () => random)
    patrol.update(100)
    assert.equal(patrol.x, edge)
    assert.equal(patrol.walking, false)
    assert.equal(patrol.direction, direction)
    patrol.update(500)
    patrol.update(100)
    assert.equal(patrol.x, edge + direction * 10)
    for (let index = 0; index < 100; index++) { patrol.update(300); assert.ok(patrol.x >= 0 && patrol.x <= 100) }
  }
})

test('walking and pause timers account for elapsed time across multiple state changes', () => {
  const one = new Wanderer(50, { left: 0, right: 1000 }, movement, () => 0.75)
  const many = new Wanderer(50, { left: 0, right: 1000 }, movement, () => 0.75)
  one.update(2500)
  for (let index = 0; index < 25; index++) many.update(100)
  assert.equal(one.x, many.x)
  assert.equal(one.walking, many.walking)
  const x = one.x
  one.update(0)
  assert.equal(one.x, x)
})

test('legacy district counts stay empty alongside the shared outdoor populations', () => {
  const config = content().patrols
  const expected = { center: [0, 0, 0, 0], factory: [0, 0, 0, 0], 'living-district': [0, 0, 0, 0] }
  for (const [location, counts] of Object.entries(expected)) {
    assert.deepEqual(DAY_PHASES.map(phase => resolvePatrolPopulation(config, location, phase)?.count ?? 0), counts)
  }
  config.locations.center.enabled = false
  assert.equal(resolvePatrolPopulation(config, 'center', 'night'), undefined)
  assert.equal(resolvePatrolPopulation(config, 'missing', 'night'), undefined)
})

test('patrol animation crops fit the supplied sheet and contain six idle/eight walk frames', () => {
  const definition = content().patrols.types.patrol
  const png = readFileSync(new URL(`../../public/${definition.path}`, import.meta.url))
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
  const ratio = width / definition.referenceWidth
  assert.equal(definition.idleSteps.length, 6)
  assert.equal(definition.walk.steps.length, 8)
  for (const crop of [...definition.idleSteps, ...definition.walk.steps]) {
    assert.ok((crop.x + crop.width) * ratio <= width)
    assert.ok((crop.y + crop.height) * ratio <= height)
  }
})

test('invalid patrol counts, movement ranges, references and crops identify the authoring file', () => {
  const cases = [
    [data => { data.patrols.locations.center.counts.night = -1 }, /patrols\/locations\/center.json.counts.night/],
    [data => { data.patrols.locations.center.counts.night = 1.5 }, /counts.night/],
    [data => { data.patrols.locations.center.bounds.left = 0.99 }, /bounds: left must be less/],
    [data => { data.patrols.locations.center.type = 'missing' }, /type: unknown ID/],
    [data => { data.patrols.types.patrol.movement.minWalkMs = 99999 }, /patrols\/types\/patrol\/index.json.movement: minimum/],
    [data => { data.patrols.types.patrol.walk.steps[0].x = 99999 }, /animations\/walk.json.steps: crop exceeds/],
    [data => { data.patrols.types.patrol.walk.steps[0].anchorX = 99999 }, /animations\/walk.json.steps: anchor exceeds/],
    [data => { data.patrols.types.patrol.attack.steps[0].x = 99999 }, /animations\/attack.json.steps: crop exceeds/],
    [data => { data.patrols.types.patrol.death.steps[0].anchorY = 99999 }, /animations\/death.json.steps: anchor exceeds/],
    [data => { delete data.patrols.types.patrol.frameSize }, /anchored frames require frameSize/],
  ]
  for (const [mutate, pattern] of cases) {
    const { data, sources } = catalogue()
    mutate(data)
    assert.throws(() => validateContent(data, sources), pattern)
  }
})

test('attack and death crops fit the sheet and normalized frames without clipping limbs or the baton', () => {
  const definition = content().patrols.types.patrol
  assert.equal(definition.combat.meleeDamage, 20)
  assert.ok(definition.attack.steps.length >= 5)
  assert.ok(definition.death.steps.length >= 5)
  const png = readFileSync(new URL(`../../public/${definition.path}`, import.meta.url))
  const height = png.readUInt32BE(20)
  for (const step of [...definition.attack.steps, ...definition.death.steps]) {
    assert.ok(step.x + step.width <= definition.referenceWidth)
    assert.ok(step.y + step.height <= height)
    const scale = step.scale ?? 1
    const left = definition.frameSize.width / 2 - step.anchorX * scale
    const top = definition.frameSize.height - step.anchorY * scale
    assert.ok(left >= 0 && top >= 0)
    assert.ok(left + step.width * scale <= definition.frameSize.width)
    assert.ok(top + step.height * scale <= definition.frameSize.height + 3, 'small authored foot padding may be clipped')
  }
  assert.equal(definition.frameSize.referenceHeight, 184, 'larger frames preserve the standing body scale')
})
