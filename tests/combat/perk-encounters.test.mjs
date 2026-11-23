import assert from 'node:assert/strict'
import test from 'node:test'
import { PatrolPerkTracker } from '../../src/domain/combat/patrolCombat.ts'

const observation = { alive: true, visible: true, hidden: false, inRange: true, detected: false }

test('hidden range rewards once per living officer, never per frame or repeated concealment', () => {
  const tracker = new PatrolPerkTracker()
  assert.deepEqual(tracker.observe('a', { ...observation, hidden: true }), ['policeHidden'])
  for (let i = 0; i < 100; i++) assert.deepEqual(tracker.observe('a', { ...observation, hidden: true }), [])
  tracker.observe('a', observation)
  assert.deepEqual(tracker.observe('a', { ...observation, hidden: true }), [])
  assert.deepEqual(tracker.observe('b', { ...observation, hidden: true }), ['policeHidden'])
  assert.deepEqual(tracker.observe('dead', { ...observation, hidden: true, alive: false }), [])
  assert.deepEqual(tracker.observe('invisible', { ...observation, hidden: true, visible: false }), [])
  assert.deepEqual(tracker.observe('distant', { ...observation, hidden: true, inRange: false }), [])
})

test('escaping requires a previous chase and leaving range; repeated frames do not score', () => {
  const tracker = new PatrolPerkTracker()
  const outside = { ...observation, inRange: false }
  assert.deepEqual(tracker.observe('a', outside), [])
  tracker.observe('a', { ...observation, detected: true })
  assert.deepEqual(tracker.observe('a', outside), ['policeEscaped'])
  assert.deepEqual(tracker.observe('a', outside), [])
  tracker.observe('a', { ...observation, detected: true })
  assert.deepEqual(tracker.observe('a', outside), ['policeEscaped'])
})

test('death, changing context or concealment cancels chase credit without awarding escape', () => {
  for (const end of [{ alive: false }, { visible: false }, { hidden: true }]) {
    const tracker = new PatrolPerkTracker()
    tracker.observe('a', { ...observation, detected: true })
    assert.deepEqual(tracker.observe('a', { ...observation, inRange: false, ...end }),
      end.hidden ? ['chaseHidden'] : [])
    assert.deepEqual(tracker.observe('a', { ...observation, inRange: false }), [])
  }
  const tracker = new PatrolPerkTracker()
  tracker.observe('a', { ...observation, detected: true })
  tracker.cancelChases()
  assert.deepEqual(tracker.observe('a', { ...observation, inRange: false }), [])
})
