import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('equipped clothing sheets provide every hero action within the sheet and display canvas', () => {
  const { hero } = content()
  assert.deepEqual(Object.keys(hero.outfits).sort(), ['chef-jacket', 'medical-coat', 'military-coat', 'work-jacket'])
  for (const outfit of Object.values(hero.outfits)) {
    const png = readFileSync(new URL(`../../public/${outfit.asset.path}`, import.meta.url))
    assert.equal(outfit.asset.referenceWidth, png.readUInt32BE(16))
    for (const key of Object.values(hero.actions)) {
      assert.equal(outfit.steps[key].length, hero.steps[key].length)
      for (const [index, frame] of outfit.steps[key].entries()) {
        const main = hero.steps[key][index]
        if (key === hero.actions.run || key === hero.actions.jump) {
          assert.equal(frame.scale, 0.75)
          assert.equal(main.scale, 0.75)
        } else {
          assert.ok(Math.abs(frame.height * frame.scale - main.height * (main.scale ?? 1)) < 0.001,
            `${outfit.asset.key} ${key} ${index}: match the main outfit's pose proportions`)
        }
        assert.ok(frame.x >= 0 && frame.y >= 0)
        assert.ok(frame.x + frame.width <= png.readUInt32BE(16))
        assert.ok(frame.y + frame.height <= png.readUInt32BE(20))
        assert.ok(frame.width * frame.scale <= hero.settings.frameWidth)
        assert.ok(frame.anchorY * frame.scale <= hero.settings.frameHeight)
      }
    }
  }
})

test('outfits reject unknown clothing, missing actions and invalid crops', () => {
  const unknown = content()
  unknown.hero.outfits.missing = unknown.hero.outfits['chef-jacket']
  assert.throws(() => validateContent(unknown), /outfits.missing.*armor item/)
  const missing = content()
  delete missing.hero.outfits['chef-jacket'].steps[missing.hero.actions.run]
  assert.throws(() => validateContent(missing), /outfits.chef-jacket.steps.hero-run/)
  const invalid = content()
  invalid.hero.outfits['chef-jacket'].steps[invalid.hero.actions.idle][0].x = invalid.hero.outfits['chef-jacket'].asset.referenceWidth
  assert.throws(() => validateContent(invalid), /outfits.chef-jacket.*invalid crop/)
})
