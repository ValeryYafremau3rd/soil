import assert from 'node:assert/strict'
import test from 'node:test'
import { moveSelection } from '../../src/ui/components/selection.ts'

test('S advances to the next destination and W returns to the previous one', () => {
  assert.equal(moveSelection(0, 3, 1), 1)
  assert.equal(moveSelection(1, 3, -1), 0)
})

test('navigation wraps between the first and last destinations', () => {
  assert.equal(moveSelection(0, 3, -1), 2)
  assert.equal(moveSelection(2, 3, 1), 0)
})

test('a single destination stays selected and an empty list stays safe', () => {
  assert.equal(moveSelection(0, 1, 1), 0)
  assert.equal(moveSelection(0, 1, -1), 0)
  assert.equal(moveSelection(0, 0, 1), 0)
})
