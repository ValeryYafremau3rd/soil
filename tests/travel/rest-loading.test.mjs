import test from 'node:test'
import assert from 'node:assert/strict'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { LocationLoadingService } from '../../src/app/services/session/LocationLoadingService.ts'

for (const threat of ['combat', 'fear aura', 'both']) for (const kind of ['rest', 'sleep']) {
  test(`${kind} is blocked during ${threat}, including an open menu and a pending transition`, t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const time = new DayTimeService(), loading = new LocationLoadingService(200)
    let recoveries = 0, saves = 0
    const rest = new RestService(time, { recover: () => { recoveries++ } },
      { rest: 3, sleep: 7 }, () => { saves++ }, loading)
    const before = time.getSnapshot()
    rest.setCombatActive(threat !== 'fear aura', threat !== 'combat')
    for (let i = 0; i < 2; i++) { rest.open(kind, 'Furniture'); rest.confirm(4) }
    assert.equal(rest.getSnapshot().menu, null)
    assert.equal(loading.getSnapshot().phase, 'idle')
    rest.setCombatActive(false)
    rest.open(kind, 'Furniture')
    assert.ok(rest.getSnapshot().menu)
    rest.setCombatActive(threat !== 'fear aura', threat !== 'combat')
    assert.equal(rest.getSnapshot().menu, null)
    rest.confirm(4)
    rest.setCombatActive(false)
    rest.open(kind, 'Furniture')
    rest.confirm(4)
    rest.setCombatActive(threat !== 'fear aura', threat !== 'combat')
    t.mock.timers.tick(200)
    t.mock.timers.tick(400)
    t.mock.timers.tick(200)
    assert.deepEqual(time.getSnapshot(), before)
    assert.equal(recoveries, 0)
    assert.equal(saves, 0)
    assert.equal(loading.getSnapshot().phase, 'idle')
    rest.setCombatActive(false)
    rest.open(kind, 'Furniture')
    rest.confirm(1)
    t.mock.timers.tick(200)
    assert.equal(recoveries, 1)
    assert.equal(saves, kind === 'sleep' ? 1 : 0)
    assert.equal(time.getSnapshot().phase, 'afternoon')
  })
}

for (const kind of ['rest', 'sleep']) {
  test(`${kind} covers time changes, blocks repeated actions and finishes the loading screen`, t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const time = new DayTimeService(1, 'evening'), loading = new LocationLoadingService(200)
    let recoveries = 0, saves = 0
    const rest = new RestService(time, { recover: () => { recoveries++ } },
      { rest: 3, sleep: 7 }, () => { saves++ }, loading)
    rest.open(kind, 'Furniture')
    rest.close()
    rest.confirm(3)
    assert.equal(loading.getSnapshot().phase, 'idle', 'cancel starts no transition')
    rest.open(kind, 'Furniture')
    rest.confirm(3)
    assert.equal(loading.getSnapshot().phase, 'fade-out')
    assert.ok(loading.getSnapshot().locationName.startsWith(kind === 'sleep' ? 'Sleeping' : 'Resting'))
    assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 1, phase: 'evening' })
    rest.open(kind, 'Furniture'); rest.confirm(1)
    assert.equal(rest.getSnapshot().menu, null)
    t.mock.timers.tick(200)
    assert.equal(loading.getSnapshot().phase, 'loading')
    assert.deepEqual((({ day, phase }) => ({ day, phase }))(time.getSnapshot()), { day: 2, phase: 'afternoon' })
    assert.equal(recoveries, 1)
    assert.equal(saves, kind === 'sleep' ? 1 : 0)
    t.mock.timers.tick(400)
    assert.equal(loading.getSnapshot().phase, 'fade-in')
    rest.open(kind, 'Furniture')
    assert.equal(rest.getSnapshot().menu, null)
    t.mock.timers.tick(200)
    assert.equal(loading.getSnapshot().phase, 'idle')
    rest.open(kind, 'Furniture')
    assert.ok(rest.getSnapshot().menu, 'interaction resumes')
    assert.equal(recoveries, 1)
  })
}

test('rest cannot open during another loading transition', () => {
  const loading = new LocationLoadingService(200)
  const rest = new RestService(new DayTimeService(), { recover: () => assert.fail('unexpected recovery') },
    { rest: 3, sleep: 7 }, () => {}, loading)
  loading.begin('Factory')
  rest.open('rest', 'Bench')
  rest.confirm(1)
  assert.equal(rest.getSnapshot().menu, null)
  assert.equal(loading.getSnapshot().locationName, 'Factory')
})
