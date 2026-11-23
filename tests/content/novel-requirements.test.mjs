import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogue } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { itemRequirementStates, unmetItemRequirements } from '../../src/domain/inventory/items.ts'

test('only novels require Erudition; specialist items use practical skills', () => {
  const { data, sources } = catalogue()
  const novels = new Set(['detective-book', 'romance-book', 'sci-fi-book', 'fantasy-book'])
  for (const item of data.items) {
    if (novels.has(item.id)) {
      assert.equal(item.eruditionRequired, 4, item.id)
      assert.equal(item.skillRequirements, undefined, item.id)
      assert.equal(unmetItemRequirements(item, { erudition: 3 }).length, 1, item.id)
      assert.deepEqual(unmetItemRequirements(item, { erudition: 4 }), [], item.id)
    } else {
      assert.equal(item.eruditionRequired, undefined, item.id)
      assert.equal(item.requirementMode, undefined, item.id)
      if (item.equipmentSlot || item.readable || item.ammunition
        || item.category === 'Medical' && !['bandage', 'balm-tin'].includes(item.id)) {
        assert.ok(Object.keys(item.skillRequirements ?? {}).length, item.id)
      }
      assert.ok(itemRequirementStates(item, {}).every(entry => entry.skill !== 'erudition'), item.id)
    }
  }
  assert.doesNotThrow(() => validateContent(data, sources))
})

test('Erudition training books require Medicine instead of Erudition', () => {
  const { data } = catalogue()
  for (const [id, required] of [['health-magazine-erudition', 4], ['chemistry-erudition', 12]]) {
    const item = data.items.find(item => item.id === id)
    assert.deepEqual(item.skillRequirements, { medicine: required })
    assert.deepEqual(unmetItemRequirements(item, { erudition: 0, medicine: required }), [])
    assert.deepEqual(unmetItemRequirements(item, { erudition: 0, medicine: required - 1 }),
      [{ skill: 'medicine', required, current: required - 1 }])
  }
})
