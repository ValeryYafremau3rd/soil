import assert from 'node:assert/strict'
import test from 'node:test'
import { moveInventorySelection } from '../../src/ui/inventory/navigation.ts'

test('horizontal navigation crosses the shared boundary in both rows', () => {
  for (const row of [0, 1]) {
    const left = { side: 'inventory', index: row * 3 + 2 }
    const right = { side: 'container', index: row * 3 }
    assert.deepEqual(moveInventorySelection(left, 'right', 6, 6), right)
    assert.deepEqual(moveInventorySelection(right, 'left', 6, 6), left)
  }
})

test('vertical navigation preserves columns, including empty slots', () => {
  for (const side of ['inventory', 'container']) {
    for (let column = 0; column < 3; column++) {
      const top = { side, index: column }
      const bottom = { side, index: column + 3 }
      assert.deepEqual(moveInventorySelection(top, 'down', 6, 6), bottom)
      assert.deepEqual(moveInventorySelection(bottom, 'up', 6, 6), top)
      assert.deepEqual(moveInventorySelection(top, 'up', 6, 6), top)
      assert.deepEqual(moveInventorySelection(bottom, 'down', 6, 6), bottom)
    }
  }
})

test('outer edges do not wrap into unrelated rows or a missing container', () => {
  const left = { side: 'inventory', index: 3 }
  const right = { side: 'container', index: 2 }
  assert.deepEqual(moveInventorySelection(left, 'left', 6, 6), left)
  assert.deepEqual(moveInventorySelection(right, 'right', 6, 6), right)
  assert.deepEqual(moveInventorySelection({ side: 'inventory', index: 2 }, 'right', 6), { side: 'inventory', index: 2 })
})

test('large containers scroll vertically and cross back to the nearest inventory row', () => {
  assert.deepEqual(moveInventorySelection({ side: 'container', index: 5 }, 'down', 6, 12), { side: 'container', index: 8 })
  assert.deepEqual(moveInventorySelection({ side: 'container', index: 9 }, 'left', 6, 12), { side: 'inventory', index: 5 })
})
