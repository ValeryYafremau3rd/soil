import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { content } from '../helpers/content.mjs'

test('all items reusing supplied items2 artwork have valid sheet dimensions and crops', () => {
  const items = content().items.filter(item => item.iconSheet?.path === 'assets/items/items2.png')
  assert.ok(items.length >= 61, 'the original catalogue remains represented while new reading items reuse existing art')
  assert.equal(new Set(items.map(item => item.id)).size, items.length)
  const png = readFileSync(new URL('../../public/assets/items/items2.png', import.meta.url))
  for (const item of items) {
    assert.equal(item.iconSheet.width, png.readUInt32BE(16), item.id)
    assert.equal(item.iconSheet.height, png.readUInt32BE(20), item.id)
    assert.ok(item.icon.x >= 0 && item.icon.y >= 0 && item.icon.x + item.icon.width <= item.iconSheet.width && item.icon.y + item.icon.height <= item.iconSheet.height, item.id)
    assert.ok(item.description.length > 10 && item.rarity && item.price > 0)
    if (item.iconClip) {
      assert.ok(item.iconClip.length >= 3)
      assert.ok(item.iconClip.every(point => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1))
    }
  }
})
