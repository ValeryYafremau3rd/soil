import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('every hero crop fits the updated sheet with valid anchors and horizontal canvas margins', () => {
  const { hero } = content()
  const png = readFileSync(new URL('../../public/assets/characters/hero.png', import.meta.url))
  const ratio = png.readUInt32BE(16) / hero.asset.referenceWidth
  const sheetHeight = png.readUInt32BE(20)
  for (const [action, key] of Object.entries(hero.actions)) {
    for (const [index, frame] of hero.steps[key].entries()) {
      const label = `${action} ${index}`
      assert.ok(frame.x >= 0 && frame.y >= 0, label)
      assert.ok((frame.x + frame.width) * ratio <= png.readUInt32BE(16), label)
      assert.ok((frame.y + frame.height) * ratio <= sheetHeight, label)
      const scale = frame.scale ?? 1
      const left = hero.settings.frameWidth / 2 - (frame.anchorX ?? frame.width / 2) * scale
      const top = hero.settings.frameHeight - (frame.anchorY ?? frame.height) * scale
      assert.ok(left >= 0 && top >= 0, label)
      assert.ok(left + frame.width * scale <= hero.settings.frameWidth, label)
      assert.ok(frame.anchorY >= 0 && frame.anchorY <= frame.height, label)
      for (const excluded of frame.excludeRegions ?? []) {
        assert.ok(excluded.x >= 0 && excluded.y >= 0, label)
        assert.ok(excluded.x + excluded.width <= frame.width && excluded.y + excluded.height <= frame.height, label)
      }
    }
  }
})

test('hero hurt and death animations use all authored poses and do not loop', () => {
  const { hero } = content()
  assert.equal(hero.steps[hero.actions.hurt].length, 6)
  assert.equal(hero.steps[hero.actions.death].length, 8)
  for (const action of ['hurt', 'death']) {
    assert.equal(hero.animations[hero.actions[action]].repeat, 0)
    assert.ok(hero.animations[hero.actions[action]].frameRate > 0)
  }
  const invalid = content()
  invalid.hero.steps[invalid.hero.actions.hurt][0].scale = 0
  assert.throws(() => validateContent(invalid), /scale/)
})

test('hero frame exclusions cannot erase outside their crop', () => {
  const data = content()
  const frame = data.hero.steps[data.hero.actions.run][3]
  frame.excludeRegions = [{ x: frame.width - 1, y: 0, width: 5, height: 5 }]
  assert.throws(() => validateContent(data), /excludeRegions: outside crop/)
})
