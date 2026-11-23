import assert from 'node:assert/strict'
import test from 'node:test'
import { content, contentFiles } from '../helpers/content.mjs'

test('town notes are readable, fixed finds and excluded from random supplies', () => {
  const data = content()
  const files = contentFiles()
  const placements = [
    ['living-district/containers.json', 'living-district-cover-box', 'nurse-unsent-letter'],
    ['center/containers.json', 'center-locker-box', 'shopkeeper-hidden-list'],
    ['factory/containers.json', 'factory-night-log-lockbox', 'factory-night-shift-log'],
    ['living-district/buildings/apartments/rooms/apartment-31/containers.json',
      'apartment-notice-case', 'apartment-notice'],
  ]
  for (const [path, id, itemId] of placements) {
    const container = files[`./locations/${path}`].find(entry => entry.id === id)
    assert.ok(container.items.some(item => item.itemId === itemId && item.quantity === 1))
    assert.equal(container.restock, false)
    assert.equal(container.lootTable, undefined)
  }
  for (const id of [...placements.map(entry => entry[2]), 'soldier-pocket-note']) {
    const item = data.items.find(entry => entry.id === id)
    assert.equal(item.category, 'Document')
    assert.equal(item.randomLoot, false)
    assert.equal(item.saleable, false)
    assert.ok(item.readingText.length > 300)
    assert.equal(item.readingText.includes(' ? '), false)
  }
  const drops = files['./loot-tables/corpses/solider.json']
  assert.deepEqual(drops.find(entry => entry.itemId === 'soldier-pocket-note'), {
    itemId: 'soldier-pocket-note', min: 1, max: 1, chance: 0.05,
  })
})
