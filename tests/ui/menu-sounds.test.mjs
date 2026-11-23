import assert from 'node:assert/strict'
import test from 'node:test'
import { bindMenuSounds } from '../../src/platform/ui/bindMenuSounds.ts'
import { isMenuSoundKey, menuSoundControl } from '../../src/platform/ui/menuSoundTargets.ts'

class ElementStub {
  constructor({ disabled = false, editing = false, option = false, spinbutton = false } = {}) {
    Object.assign(this, { disabled, editing, option, spinbutton, value: '1' })
  }
  closest(selector) {
    if (selector.startsWith(':disabled')) return this.disabled ? this : null
    if (selector.startsWith('input:not')) return this.editing ? this : null
    if (selector === '[role="option"]') return this.option ? this : null
    return this
  }
  matches(selector) { return selector === '[role="spinbutton"]' && this.spinbutton }
  contains(target) { return target === this }
  getAttribute(name) { return name === 'aria-valuenow' ? this.value : 'false' }
}

function key(key, overrides = {}) {
  return { key, target: new ElementStub(), altKey: false, ctrlKey: false, metaKey: false,
    repeat: false, isComposing: false, defaultPrevented: false, ...overrides }
}

function environment(t) {
  const listeners = new Map()
  let notify, disconnected = false
  const previous = Object.fromEntries(['Element', 'Node', 'MutationObserver'].map(id =>
    [id, globalThis[id]]))
  Object.assign(globalThis, { Element: ElementStub, Node: ElementStub,
    MutationObserver: class {
      constructor(callback) { notify = callback }
      observe() {}
      disconnect() { disconnected = true }
    } })
  t.after(() => Object.assign(globalThis, previous))
  const target = { document: { querySelector: () => ({}) },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name) }
  return { target, listeners, notify: records => notify(records),
    disconnected: () => disconnected }
}

test('menu sound input excludes gameplay, typing, disabled controls and ignored repeats', t => {
  const { target } = environment(t)
  for (const name of ['ArrowRight', 'w', 'Home', 'End', 'Tab', 'Escape', 'Enter', ' ']) {
    assert.equal(isMenuSoundKey(key(name), target.document), true, name)
  }
  for (const overrides of [{ ctrlKey: true }, { altKey: true }, { metaKey: true },
    { isComposing: true }, { target: new ElementStub({ editing: true }) },
    { target: new ElementStub({ disabled: true }) }]) {
    assert.equal(isMenuSoundKey(key('ArrowRight', overrides), target.document), false)
  }
  assert.equal(isMenuSoundKey(key('Enter', { repeat: true }), target.document), false)
  assert.equal(isMenuSoundKey(key('ArrowRight', { repeat: true }), target.document), true)
  assert.equal(isMenuSoundKey(key('ArrowRight'), { querySelector: () => null }), false)
  assert.equal(menuSoundControl(new ElementStub({ disabled: true })), null)
  assert.equal(menuSoundControl(null), null)
})

test('mouse, custom keyboard, hover and actual wheel changes use one shared capability', async t => {
  const env = environment(t)
  let cues = 0
  const release = bindMenuSounds(env.target, { cue: () => { cues++ } })
  env.listeners.get('click')({ target: new ElementStub() })
  env.listeners.get('change')({ target: new ElementStub() })
  env.listeners.get('keydown')(key('ArrowRight'))
  env.listeners.get('keydown')(key('Enter'))
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(cues, 3, 'native Enter waits for its click')
  const custom = key('Enter')
  env.listeners.get('keydown')(custom)
  await Promise.resolve()
  assert.equal(cues, 3, 'capture microtasks can run before React handles the key')
  custom.defaultPrevented = true
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(cues, 4, 'custom activation replaces the prevented native click')
  const option = new ElementStub({ option: true })
  env.listeners.get('mouseover')({ target: option, relatedTarget: option })
  assert.equal(cues, 4)
  env.listeners.get('mouseover')({ target: option, relatedTarget: null })
  assert.equal(cues, 5)
  const wheel = new ElementStub({ spinbutton: true })
  env.notify([{ target: wheel, oldValue: '1' }])
  assert.equal(cues, 5, 'unchanged lock values remain silent')
  wheel.value = '2'
  env.notify([{ target: wheel, oldValue: '1' }])
  assert.equal(cues, 6)
  release()
  assert.equal(env.listeners.size, 0)
  assert.equal(env.disconnected(), true)
})
