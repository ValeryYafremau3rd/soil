import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { adjacentFloor, isNearEntrance, stairPosition, stairRoute, interiorClearance } from '../../src/domain/buildings/navigation.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue } from '../helpers/content.mjs'
import { content } from '../helpers/content.mjs'
const { factory: FACTORY, house: HOUSE } = content().buildings

test('interior clearance enforces the configured world minimum and fits future taller heroes', () => {
  const data = content()
  const minimum = data.settings.interaction.minimumInteriorHeight
  const height = data.hero.settings.frameHeight * data.hero.settings.scale
  const headroom = data.settings.interaction.interiorHeadroom
  assert.equal(interiorClearance(60, minimum, height, headroom), 140)
  assert.equal(interiorClearance(200, minimum, height, headroom), 200)
  assert.equal(interiorClearance(60, minimum, 180, headroom), 192)
  assert.ok(interiorClearance(60, minimum, height, headroom) >= height + headroom)
})

 test('entrance requires horizontal and vertical proximity', () => {
  const entrance = { x: 100, y: 200 }
  assert.equal(isNearEntrance({ x: 120, y: 200 }, entrance, 25), true)
  assert.equal(isNearEntrance({ x: 126, y: 200 }, entrance, 25), false)
  assert.equal(isNearEntrance({ x: 100, y: 150 }, entrance, 25), false)
})

test('stairs cannot go below the ground floor or above the top floor', () => {
  assert.equal(adjacentFloor(0, -1, 5), undefined)
  assert.equal(adjacentFloor(4, 1, 5), undefined)
  assert.equal(adjacentFloor(2, 0, 5), undefined)
  assert.equal(adjacentFloor(2, 1, 5), 3)
  assert.equal(adjacentFloor(2, -1, 5), 1)
})

test('a round trip can visit all authored floors and return to the exit', () => {
  const count = HOUSE.inner.floors.length
  let floor = 0
  for (let i = 1; i < count; i++) floor = adjacentFloor(floor, 1, count)
  assert.equal(floor, count - 1)
  for (let i = count - 1; i > 0; i--) floor = adjacentFloor(floor, -1, count)
  assert.equal(floor, 0)
})

test('stair motion follows the intermediate landing in both directions', () => {
  const lower = { x: 650, y: 984 }
  const landing = { x: 820, y: 906.5 }
  const upper = { x: 650, y: 829 }
  assert.deepEqual(stairPosition(lower, landing, upper, 0), lower)
  assert.deepEqual(stairPosition(lower, landing, upper, 0.5), landing)
  assert.deepEqual(stairPosition(lower, landing, upper, 1), upper)
  assert.deepEqual(stairPosition(lower, landing, upper, 0.25), { x: 735, y: 945.25 })
  assert.deepEqual(stairPosition(upper, landing, lower, 0.75), { x: 735, y: 945.25 })
  assert.deepEqual(stairPosition(lower, landing, upper, -1), lower)
  assert.deepEqual(stairPosition(lower, landing, upper, 2), upper)
})

test('authored floors have clearance and the default staircase ascends in image coordinates', () => {
  for (const building of [HOUSE, FACTORY]) building.inner.floors.forEach((floor, index, floors) => {
    if (!building.stairs) assert.ok(floor.left < building.stairX && building.stairX < floor.right)
    assert.ok(floor.ceiling < floor.y)
    if (index > 0 && !building.stairs) assert.ok(floor.y < floors[index - 1].y)
  })
})

test('factory crops isolate the full-width exterior and interior in the replacement sheet', () => {
  const [outer, inner] = FACTORY.sprites.map(sprite => sprite.crop)
  const png = readFileSync(new URL('../../public/assets/buildings/factory.png', import.meta.url))
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
  assert.ok(outer.y + outer.height < inner.y)
  assert.equal(outer.width, inner.width)
  for (const sprite of FACTORY.sprites) {
    const ratio = width / sprite.referenceWidth
    assert.ok((sprite.crop.x + sprite.crop.width) * ratio <= width)
    assert.ok((sprite.crop.y + sprite.crop.height) * ratio <= height)
  }
  for (const floor of FACTORY.inner.floors) {
    assert.ok(floor.y <= inner.height)
    assert.ok(floor.right <= inner.width)
  }
  assert.equal(stairRoute(FACTORY.stairs, 2, 1, 1610, 38), undefined)
})

test('factory exit, stair landings, and indoor interactions stay within the recalculated floors', () => {
  const data = content()
  const location = data.locations.find(location => location.id === 'factory')
  const instance = location.buildings.find(building => building.id === 'factory-main')
  const scale = FACTORY.scale * (instance.scale ?? 1)
  const left = instance.entranceX - FACTORY.entranceX * scale
  assert.ok(FACTORY.entranceX > FACTORY.inner.floors[0].left)
  assert.ok(FACTORY.entranceX < FACTORY.inner.floors[0].right)
  for (const stair of FACTORY.stairs) {
    const from = FACTORY.inner.floors[stair.fromFloor], to = FACTORY.inner.floors[stair.toFloor]
    assert.ok(from.left < stair.fromX && stair.fromX < from.right)
    assert.ok(to.left < stair.toX && stair.toX < to.right)
  }
  for (const placement of [...data.containers.placements, ...data.taskboards.placements]
    .filter(placement => placement.buildingId === instance.id)) {
    const floor = FACTORY.inner.floors[placement.floor ?? 0]
    const localX = (placement.x - left) / scale
    assert.ok(localX > floor.left && localX < floor.right, placement.id)
  }
})

test('factory floor clearance preserves the outdoor hero scale', () => {
  const data = content()
  const minimumClearance = Math.min(...FACTORY.inner.floors.map(floor => floor.y - floor.ceiling)) * FACTORY.scale
  assert.ok(minimumClearance >= data.hero.settings.frameHeight * data.hero.settings.scale + data.settings.interaction.interiorHeadroom)
})

test('factory ladder and right stairs reach separate catwalks and return to the ground', () => {
  assert.equal(stairRoute(FACTORY.stairs, 0, 1, 155, 38)?.targetFloor, 1)
  assert.equal(stairRoute(FACTORY.stairs, 1, -1, 155, 38)?.targetFloor, 0)
  assert.equal(stairRoute(FACTORY.stairs, 1, 1, 155, 38), undefined)
  assert.equal(stairRoute(FACTORY.stairs, 0, 1, 1485, 38)?.targetFloor, 2)
  assert.equal(stairRoute(FACTORY.stairs, 2, -1, 1610, 38)?.toX, 1485)
  assert.equal(stairRoute(FACTORY.stairs, 2, -1, 155, 38), undefined)
  assert.equal(stairRoute(FACTORY.stairs, 0, 1, 800, 38), undefined)
  assert.equal(stairRoute(FACTORY.stairs, 0, 0, 100, 38), undefined)
  assert.equal(stairRoute(FACTORY.stairs, 2, 1, 1610, 38), undefined)
})

test('factory door and stair configuration rejects unreachable doors, floors, and invalid endpoints', () => {
  for (const mutate of [
    building => { building.entrances = [994, 994] },
    building => { building.entrances = [180] },
    building => { building.entrances.push(9999) },
    building => { building.stairs.find(stair => stair.toFloor === 2).toFloor = 99 },
    building => { building.stairs.find(stair => stair.toFloor === 2).toX = 100 },
    building => { building.stairs.find(stair => stair.toFloor === 2).fromFloor = 2 },
    building => { building.stairs.pop() },
  ]) {
    const { data, sources } = catalogue()
    mutate(data.buildings.factory)
    assert.throws(() => validateContent(data, sources), /buildings\/factory.json.*(?:entrances|stairs)/)
  }
})
