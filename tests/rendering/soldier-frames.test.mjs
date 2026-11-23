import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('soldier poses and atlas-label exclusions fit their prepared canvas', () => {
  const soldier = content().patrols.types.solider
  const groups = [soldier.idleSteps, ...['walk', 'run', 'attack', 'shoot', 'death'].map(action => soldier[action].steps)]
  for (const frames of groups) for (const frame of frames) {
    const left = soldier.frameSize.width / 2 - frame.anchorX
    const top = soldier.frameSize.height - frame.anchorY
    assert.ok(left >= 0 && left + frame.width <= soldier.frameSize.width)
    // Only transparent padding below the foot anchor may extend off the canvas.
    assert.ok(top >= 0 && frame.height - frame.anchorY <= 3)
    for (const excluded of frame.excludeRegions ?? []) {
      assert.ok(excluded.x >= 0 && excluded.y >= 0)
      assert.ok(excluded.x + excluded.width <= frame.width)
      assert.ok(excluded.y + excluded.height <= frame.height)
    }
  }
})

test('patrol masks cannot erase outside a crop or bypass prepared textures', () => {
  for (const missingCanvas of [false, true]) {
    const data = content()
    const soldier = data.patrols.types.solider
    soldier.idleSteps[0].excludeRegions = [{ x: 0, y: 0, width: soldier.idleSteps[0].width + 1, height: 1 }]
    if (missingCanvas) {
      soldier.idleSteps[0].excludeRegions[0].width = 1
      delete soldier.frameSize
    }
    assert.throws(() => validateContent(data), /excludeRegions: outside crop or missing frameSize/)
  }
})
