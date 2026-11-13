import assert from 'node:assert/strict'
import test from 'node:test'
import { beginJump, blockedHorizontal, jumpGravity, restingAt, stepVertical } from '../../src/domain/movement/platforms.ts'
import { worldSurfaces } from '../../src/game/physics/surfaces.ts'

const gravity = jumpGravity(125, 700)
const floorY = 500
const crate = { id: 'crate', left: 90, right: 150, y: 430 }
const step = (state, x, platforms = [crate], ceiling = 0) => stepVertical(state, x, 8, 1 / 60, gravity, floorY, ceiling, platforms)

test('solid rooftop fixtures block swept movement from both sides but allow passage above and below', () => {
  const vent = { id: 'vent', left: 100, right: 140, y: 100, bottom: 150 }
  assert.equal(blockedHorizontal(80, 180, 145, 8, 30, [vent]), 92)
  assert.equal(blockedHorizontal(180, 80, 145, 8, 30, [vent]), 148)
  assert.equal(blockedHorizontal(80, 180, 100, 8, 30, [vent]), 180)
  assert.equal(blockedHorizontal(80, 180, 180, 8, 30, [vent]), 180)
  assert.equal(blockedHorizontal(80, 180, 145, 8, 30, [{ ...vent, bottom: undefined }]), 180)
})

test('solid fixtures stop upward head movement and support landing on top', () => {
  const vent = { id: 'vent', left: 100, right: 140, y: 100, bottom: 150 }
  const hit = stepVertical({ y: 190, velocity: -300, grounded: false }, 120, 8, 0.1, 0, 500, 0, [vent], 30)
  assert.equal(hit.y, 180)
  assert.equal(hit.velocity, 0)
  const landed = stepVertical({ y: 80, velocity: 300, grounded: false }, 120, 8, 0.1, 0, 500, 0, [vent], 30)
  assert.equal(landed.y, 100)
  assert.equal(landed.supportId, 'vent')
  assert.deepEqual(worldSurfaces('vent', { x: 10, y: 20, width: 100, height: 200 },
    [{ left: 0.1, right: 0.5, top: 0.2, bottom: 0.4 }]),
  [{ id: 'vent:0', left: 20, right: 60, y: 60, bottom: 100 }])
})

test('sloped vehicle tops land at the local height and follow connected roof segments', () => {
  const hood = { id: 'car:0', left: 100, right: 150, y: 450, rightY: 400 }
  const roof = { id: 'car:1', left: 150, right: 200, y: 400, rightY: 400 }
  const tops = [hood, roof]
  let state = stepVertical({ y: 350, velocity: 1000, grounded: false }, 125, 8, 0.1, gravity, floorY, 0, tops)
  assert.equal(state.y, 425)
  assert.equal(state.supportId, hood.id)
  state = step(state, 145, tops)
  assert.equal(state.y, 405)
  state = step(state, 160, tops)
  assert.equal(state.y, 400)
  assert.equal(state.supportId, roof.id)
  state = step(state, 140, tops)
  assert.equal(state.y, 410)
  state = step(state, 80, tops)
  assert.equal(state.grounded, false)
  assert.equal(step({ y: 400, velocity: 0, grounded: true, supportId: roof.id }, 175, []).grounded, false)
})

test('sloped surfaces transform both endpoints with the prop bounds', () => {
  assert.deepEqual(worldSurfaces('car', { x: 100, y: 200, width: 80, height: 60 },
    [{ left: 0.1, right: 0.9, top: 0.2, rightTop: 0.5 }]),
  [{ id: 'car:0', left: 108, right: 172, y: 212, rightY: 230 }])
})

test('jumping above a container lands on its top while descending', () => {
  let state = beginJump(restingAt(floorY), 125, gravity)
  for (let frame = 0; frame < 100 && !state.grounded; frame++) state = step(state, 120)
  assert.equal(state.grounded, true)
  assert.equal(state.y, crate.y)
  assert.equal(state.supportId, 'crate')
})

test('walking off a container drops the hero to the ground', () => {
  let state = { y: crate.y, velocity: 0, grounded: true, supportId: 'crate' }
  state = step(state, 200)
  assert.equal(state.grounded, false)
  for (let frame = 0; frame < 100 && !state.grounded; frame++) state = step(state, 200)
  assert.equal(state.y, floorY)
  assert.equal(state.supportId, undefined)
})

test('walking beside or through a platform below its top does not teleport the hero upward', () => {
  assert.deepEqual(step(restingAt(floorY), 120), restingAt(floorY))
})

test('an airborne hero cannot jump again, but can jump from a container', () => {
  const airborne = beginJump(restingAt(floorY), 125, gravity)
  assert.equal(beginJump(airborne, 125, gravity), airborne)
  const fromCrate = beginJump({ y: crate.y, velocity: 0, grounded: true, supportId: 'crate' }, 125, gravity)
  assert.ok(fromCrate.velocity < 0)
})

test('NPC positions are not collision surfaces and never support the hero', () => {
  let state = beginJump(restingAt(floorY), 125, gravity)
  for (let frame = 0; frame < 100 && !state.grounded; frame++) state = step(state, 120, [])
  assert.equal(state.y, floorY)
  assert.equal(state.supportId, undefined)
})

test('a large downward step lands on the highest crossed top without tunnelling', () => {
  const state = { y: 300, velocity: 1000, grounded: false }
  const lower = { ...crate, id: 'lower', y: 470 }
  const landed = stepVertical(state, 120, 8, 0.25, gravity, floorY, 0, [lower, crate])
  assert.equal(landed.y, crate.y)
  assert.equal(landed.supportId, 'crate')
})

test('ceilings stop upward motion and hidden or removed supports allow falling', () => {
  const headHit = stepVertical({ y: 420, velocity: -1000, grounded: false }, 120, 8, 0.1, gravity, floorY, 400, [])
  assert.equal(headHit.y, 400)
  assert.ok(headHit.velocity >= 0)
  const dropped = step({ y: crate.y, velocity: 0, grounded: true, supportId: 'crate' }, 120, [])
  assert.equal(dropped.grounded, false)
})

test('normalized platform bounds follow object position and scale', () => {
  const surfaces = worldSurfaces('crate', { x: 100, y: 200, width: 80, height: 60 }, [{ left: 0.1, right: 0.9, top: 0.2 }])
  assert.deepEqual(surfaces, [{ id: 'crate:0', left: 108, right: 172, y: 212 }])
})
