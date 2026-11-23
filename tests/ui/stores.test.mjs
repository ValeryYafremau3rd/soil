import assert from 'node:assert/strict'
import test from 'node:test'
import { HudService } from '../../src/app/services/ui/HudService.ts'
import { isGameplayBlocked } from '../../src/app/services/session/isGameplayBlocked.ts'

test('HUD panels reject unknown IDs and release subscriptions', () => {
  const hud = new HudService(['character', 'map'])
  let calls = 0
  const unsubscribe = hud.subscribe(() => { calls++ })
  hud.openMenu('missing')
  assert.equal(hud.getSnapshot().menuId, null)
  hud.openMenu('map')
  hud.openMenu('map')
  assert.equal(calls, 1)
  hud.closeMenu()
  assert.equal(calls, 2)
  unsubscribe()
  hud.openMenu('character')
  assert.equal(calls, 2)
})

test('each modal source blocks gameplay and releasing all modals restores it', () => {
  const states = { travel: { menuOpen: false }, dialogue: { conversation: null }, inventory: { menu: null }, hud: { menuId: null }, rest: { menu: null }, lockpicking: { puzzle: null }, quests: { boardOpen: false }, loading: { phase: 'idle' } }
  const services = Object.fromEntries(Object.entries(states).map(([id, state]) => [id, { getSnapshot: () => state }]))
  services.character = null
  assert.equal(isGameplayBlocked(services), true, 'the loaded world is blocked until a class is chosen')
  services.character = { classId: 'loader' }
  assert.equal(isGameplayBlocked(services), false)
  for (const [state, key, value] of [[states.travel, 'menuOpen', true], [states.dialogue, 'conversation', {}],
    [states.inventory, 'menu', {}], [states.hud, 'menuId', 'map'], [states.rest, 'menu', {}], [states.lockpicking, 'puzzle', {}], [states.quests, 'boardOpen', true], [states.loading, 'phase', 'fade-out']]) {
    const before = state[key]
    state[key] = value
    assert.equal(isGameplayBlocked(services), true)
    state[key] = before
    assert.equal(isGameplayBlocked(services), false)
  }
})
