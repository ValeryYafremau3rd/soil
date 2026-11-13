import test from 'node:test'
import assert from 'node:assert/strict'
import { movementEnergyCost } from '../../src/domain/movement/energy.ts'
import { content } from '../helpers/content.mjs'

test('movement charges actual distance in either direction and each successful jump', () => {
  const costs = content().hero.settings.energyCosts
  assert.equal(movementEnergyCost(0, false, costs), 0)
  assert.equal(movementEnergyCost(100, false, costs), 0.5)
  assert.equal(movementEnergyCost(0, true, costs), 1)
  assert.ok(Math.abs(movementEnergyCost(100, true, costs, 1.6) - 2.4) < 1e-10)
  assert.ok(Math.abs(movementEnergyCost(100, false, costs)
    - 100 * movementEnergyCost(1, false, costs)) < 1e-10)
})
