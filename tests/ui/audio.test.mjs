import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { AudioService } from '../../src/app/services/audio/AudioService.ts'

function store(snapshot) {
  const listeners = new Set()
  return { getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    update: patch => { snapshot = { ...snapshot, ...patch }; for (const listener of listeners) listener() }, listeners }
}
test('audio switches loading, indoor mixes, night, pursuit and death; releases subscriptions', async () => {
  const config = content().audio
  const audio = new AudioService(config)
  const services = {
    loading: store({ phase: 'idle' }), daytime: store({ phase: 'morning', day: 1 }),
    travel: store({ currentLocationId: 'factory', menuOpen: false }), status: store({ health: 100 }),
    hud: store({ menuId: null }), inventory: store({ menu: null }), dialogue: store({ conversation: null }),
    rest: store({ menu: null }), lockpicking: store({ puzzle: null }), quests: store({ boardOpen: false }),
    story: store({ flags: {} }),
  }
  let mix = new Map(), disposed = false, stoppedEffects = 0
  const cues = []
  const playback = {
    mix: next => { mix = next }, play: id => cues.push(id),
    stopEffects: () => { stoppedEffects++ }, dispose: () => { disposed = true },
  }
  const release = audio.attach(playback, services)
  assert.deepEqual([...mix.keys()], ['theme'])
  audio.setSetup(false)
  assert.ok(mix.has('calm'))
  const daytimeMix = [...mix]
  for (const phase of ['fade-out', 'loading', 'fade-in', 'idle']) {
    services.loading.update({ phase })
    assert.deepEqual([...mix], daytimeMix, `loading ${phase} preserves world audio`)
  }
  services.daytime.update({ phase: 'afternoon' })
  assert.deepEqual([...mix], daytimeMix)
  services.daytime.update({ phase: 'evening' })
  assert.deepEqual([...mix], daytimeMix)
  audio.setRunning(true); assert.ok(mix.has('running'))
  services.hud.update({ menuId: 'notes' }); assert.ok(!mix.has('running'))
  services.hud.update({ menuId: null }); audio.setRunning(false)
  await new Promise(resolve => setTimeout(resolve, 0))
  cues.length = 0
  assert.ok(!mix.has('running'))
  const outside = mix.get('factory')
  audio.setWorld(true, null)
  assert.equal(mix.get('factory'), outside * .25)
  audio.setWorld(true, 'human')
  assert.ok(mix.has('chase')); assert.ok(!mix.has('calm'))
  audio.setWorld(true, 'monster')
  assert.ok(mix.has('fight')); assert.ok(!mix.has('chase'))
  services.daytime.update({ phase: 'night' })
  assert.ok(mix.has('horror'))
  audio.setWorld(false, null)
  assert.ok(!mix.has('fight')); assert.ok(!mix.has('calm'))
  const nightMix = [...mix]
  services.loading.update({ phase: 'loading' })
  services.status.update({ health: 99 })
  assert.deepEqual([...mix], nightMix)
  services.loading.update({ phase: 'idle' })
  services.travel.update({ currentLocationId: 'center' })
  assert.ok(mix.has('horror')); assert.ok(mix.has('city')); assert.ok(!mix.has('factory'))
  const centerNightMix = [...mix]
  services.travel.update({ currentLocationId: 'living-district' })
  assert.deepEqual([...mix], centerNightMix)
  services.daytime.update({ phase: 'morning', day: 2 })
  assert.ok(!mix.has('horror')); assert.ok(mix.has('calm2'))
  services.hud.update({ menuId: 'notes' }); services.hud.update({ menuId: 'notes' })
  await new Promise(resolve => setTimeout(resolve, 0))
  services.hud.update({ menuId: null })
  assert.deepEqual(cues, ['ui', 'ui'])
  audio.spotted('titan'); audio.spotted('fly'); audio.cue('meleeMiss')
  assert.deepEqual(cues.slice(-3), ['titanSpotted', 'spotted', 'miss'])
  services.status.update({ health: 0 }); assert.equal(mix.size, 0)
  assert.equal(cues.at(-1), 'newDay')
  const deathCues = cues.filter(id => id === 'newDay').length
  services.status.update({ health: 0 })
  services.loading.update({ phase: 'loading' })
  services.daytime.update({ phase: 'afternoon' })
  assert.equal(cues.filter(id => id === 'newDay').length, deathCues)
  services.story.update({ flags: { prologue_complete: true } })
  assert.deepEqual([...mix.keys()], [config.music.ending])
  assert.equal(stoppedEffects, 1)
  const endingCues = cues.length
  audio.cue('shot'); audio.spotted('titan'); audio.setWorld(false, 'monster')
  services.hud.update({ menuId: 'notes' })
  services.story.update({ flags: { prologue_complete: true } })
  assert.equal(cues.length, endingCues)
  assert.equal(stoppedEffects, 1)
  assert.deepEqual([...mix.keys()], [config.music.ending])
  services.story.update({ flags: {} })
  assert.equal(mix.size, 0)
  release(); assert.ok(disposed)
  const attachDead = audio.attach({ ...playback, dispose: () => {} }, services)
  assert.equal(cues.filter(id => id === 'newDay').length, deathCues)
  attachDead()
  for (const service of Object.values(services)) assert.equal(service.listeners.size, 0)
})

test('UI actions coalesce resulting cues, respect mute and still sound during endings', async () => {
  const config = content().audio
  const audio = new AudioService(config)
  const cues = []
  const services = {
    loading: store({ phase: 'idle' }), daytime: store({ phase: 'night', day: 1 }),
    travel: store({ currentLocationId: 'factory', menuOpen: false }), status: store({ health: 100 }),
    hud: store({ menuId: null }), inventory: store({ menu: null }),
    dialogue: store({ conversation: null }), rest: store({ menu: null }),
    lockpicking: store({ puzzle: null }), quests: store({ boardOpen: false }),
    story: store({ flags: {} }),
  }
  const release = audio.attach({ play: id => cues.push(id), mix() {},
    stopEffects() {}, dispose() {} }, services)
  audio.cue('ui')
  services.inventory.update({ menu: { kind: 'inventory' } })
  audio.cue('ui')
  audio.cue('ui')
  assert.deepEqual(cues, ['ui'])
  await new Promise(resolve => setTimeout(resolve, 0))
  services.story.update({ flags: { prologue_complete: true } })
  audio.cue('ui')
  audio.cue('shot')
  assert.deepEqual(cues, ['ui', 'ui'])
  await new Promise(resolve => setTimeout(resolve, 0))
  audio.toggleSound()
  try {
    audio.cue('ui')
    assert.deepEqual(cues, ['ui', 'ui'])
  } finally {
    audio.toggleSound()
    release()
  }
})
