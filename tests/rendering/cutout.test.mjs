import assert from 'node:assert/strict'
import test from 'node:test'
import { removeEdgeBackground } from '../../src/game/rendering/removeEdgeBackground.ts'

test('checkerboard removal preserves the object and its enclosed pale window', () => {
  const data = new Uint8ClampedArray(5 * 5 * 4).fill(255)
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 3; x++) {
      if (x === 2 && y === 2) continue
      data.set([90, 70, 40, 255], (y * 5 + x) * 4)
    }
  }
  removeEdgeBackground(data, 5, 5)
  assert.equal(data[3], 0)
  assert.equal(data[(4 * 5 + 4) * 4 + 3], 0)
  assert.equal(data[(1 * 5 + 1) * 4 + 3], 255)
  assert.equal(data[(2 * 5 + 2) * 4 + 3], 255)
})

test('pale coloured artwork at the image edge is preserved', () => {
  const data = new Uint8ClampedArray([255, 225, 225, 255, 240, 242, 240, 255])
  removeEdgeBackground(data, 2, 1)
  assert.equal(data[3], 255)
  assert.equal(data[7], 0)
})

test('dark backdrop removal preserves the container artwork', () => {
  const data = new Uint8ClampedArray([0, 0, 0, 255, 75, 60, 45, 255, 2, 2, 2, 255])
  removeEdgeBackground(data, 3, 1, 'dark')
  assert.equal(data[3], 0)
  assert.equal(data[7], 255)
  assert.equal(data[11], 0)
})

test('a custom matte removes cool backdrop pixels while preserving warm dark clothing', () => {
  const data = new Uint8ClampedArray([10, 20, 30, 255, 30, 20, 10, 255, 10, 20, 30, 255])
  removeEdgeBackground(data, 3, 1, (red, green, blue) => red < green && green < blue)
  assert.equal(data[3], 0)
  assert.equal(data[7], 255)
  assert.equal(data[11], 0)
})
