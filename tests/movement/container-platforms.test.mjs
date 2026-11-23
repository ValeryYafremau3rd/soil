import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { beginJump, jumpGravity, restingAt, stepVertical } from '../../src/domain/movement/platforms.ts'
import { worldSurfaces } from '../../src/game/physics/surfaces.ts'

const floor = 500
function containerTop(id, definition, placementScale = 1) {
  const height = definition.displayHeight * definition.scale * placementScale
  return worldSurfaces(id, {
    x: 100, y: floor - height * (definition.groundOrigin ?? 1),
    width: height * definition.width / definition.height, height,
  }, [definition.platform])[0]
}

test('every authored container supports landing, jumping again and walking off at different scales', () => {
  const { containers, hero } = content()
  const gravity = jumpGravity(hero.settings.jumpHeight, hero.animations[hero.actions.jump].durationMs)
  for (const [id, definition] of Object.entries(containers.types)) {
    assert.ok(definition.platform, `${id} needs a standable top`)
    for (const scale of [0.6, 1, 1.4]) {
      const platform = containerTop(id, definition, scale)
      const x = (platform.left + platform.right) / 2
      const landed = stepVertical({ y: platform.y - 5, velocity: 100, grounded: false },
        x, 8, 0.1, gravity, floor, 0, [platform])
      assert.equal(landed.supportId, platform.id, `${id}/${scale}`)
      const jump = beginJump(landed, hero.settings.jumpHeight, gravity)
      assert.ok(jump.velocity < 0)
      assert.equal(jump.supportId, undefined)
      const off = stepVertical(landed, platform.right + 20, 8, 1 / 60, gravity, floor, 0, [platform])
      assert.equal(off.grounded, false)
      const hidden = stepVertical(landed, x, 8, 1 / 60, gravity, floor, 0, [])
      assert.equal(hidden.grounded, false)
    }
  }
})

test('ordinary low containers are reachable with the configured base jump', () => {
  const { containers, hero } = content()
  const jumpHeight = hero.settings.jumpHeight
  const gravity = jumpGravity(jumpHeight, hero.animations[hero.actions.jump].durationMs)
  for (const id of ['crate', 'developer-crate', 'smuggler-crate', 'suitcase', 'toolbox', 'trash']) {
    const platform = containerTop(id, containers.types[id])
    let state = beginJump(restingAt(floor), jumpHeight, gravity)
    for (let frame = 0; frame < 120 && !state.grounded; frame++) {
      state = stepVertical(state, (platform.left + platform.right) / 2, 8, 1 / 120, gravity, floor, 0, [platform])
    }
    assert.equal(state.supportId, platform.id, `${id}: height ${floor - platform.y}, jump ${jumpHeight}`)
  }
})
