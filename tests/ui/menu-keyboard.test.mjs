import assert from 'node:assert/strict'
import test from 'node:test'
import { menuAction } from '../../src/platform/ui/menuNavigation.ts'
import { menuKeyboard } from '../../src/ui/components/menuKeyboard.ts'
import { selectionIndex } from '../../src/ui/components/selection.ts'

function event(key, overrides = {}) {
  return { key, altKey: false, ctrlKey: false, metaKey: false, nativeEvent: { isComposing: false },
    repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true },
    stopPropagation() { this.stopped = true }, ...overrides }
}

function menu() {
  const document = { activeElement: null }
  const buttons = Array.from({ length: 3 }, (_, index) => ({
    disabled: false, hidden: false, selected: index === 0, clicks: 0,
    closest(selector) { return selector === 'button' ? this : selector === '[hidden]' && this.hidden ? this : null },
    getAttribute() { return String(this.selected) },
    click() { this.clicks++; buttons.forEach(button => { button.selected = button === this }) },
    focus() { document.activeElement = this }, scrollIntoView() {},
  }))
  const root = { ownerDocument: document, querySelectorAll: () => buttons }
  const detail = { closest: () => null }
  return { buttons, root, document, detail, key: (key, target = detail, overrides = {}) => event(key, { target, currentTarget: root, ...overrides }) }
}

test('menus decode configured WASD, arrows and activation while ignoring modified/composing/handled events', () => {
  for (const [key, action] of [['W', 'up'], ['s', 'down'], ['a', 'left'], ['D', 'right'], ['ArrowRight', 'right'], [' ', 'choose'], ['Enter', 'choose']]) {
    assert.equal(menuAction(event(key)), action)
  }
  for (const override of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { nativeEvent: { isComposing: true } }, { defaultPrevented: true }]) {
    assert.equal(menuAction(event('ArrowRight', override)), undefined)
  }
})

test('tab switching works from details and wraps to the first tab', () => {
  const ui = menu()
  menuKeyboard(ui.key('d'), { tabs: 'tabs' })
  assert.equal(ui.document.activeElement, ui.buttons[1])
  menuKeyboard(ui.key('ArrowRight'), { tabs: 'tabs' })
  menuKeyboard(ui.key('ArrowRight'), { tabs: 'tabs' })
  assert.equal(ui.document.activeElement, ui.buttons[0])
})

test('list navigation excludes disabled and collapsed entries and clamps at boundaries', () => {
  const ui = menu()
  ui.buttons[1].disabled = true
  ui.buttons[2].hidden = true
  menuKeyboard(ui.key('s'), { items: 'entries', wrap: false })
  menuKeyboard(ui.key('ArrowDown', ui.buttons[0]), { items: 'entries', wrap: false })
  assert.equal(ui.document.activeElement, ui.buttons[0])
  assert.equal(selectionIndex(0, 0, 'last'), 0)
  assert.equal(selectionIndex(0, 3, 'up', false), 0)
  assert.equal(selectionIndex(2, 3, 'down'), 0)
})

test('activation runs once, preserves links/text editing, and ignores disabled buttons', () => {
  const ui = menu()
  menuKeyboard(ui.key('Enter', ui.buttons[0]))
  menuKeyboard(ui.key('Enter', ui.buttons[0], { repeat: true }))
  assert.equal(ui.buttons[0].clicks, 1)
  ui.buttons[0].disabled = true
  menuKeyboard(ui.key('Enter', ui.buttons[0]))
  assert.equal(ui.buttons[0].clicks, 1)
  for (const selector of ['a', 'input, textarea, select, [contenteditable="true"]']) {
    const target = { closest: query => query === selector ? {} : null }
    const input = ui.key('Enter', target)
    menuKeyboard(input, { choose: () => assert.fail('must preserve native interaction') })
    assert.equal(input.defaultPrevented, false)
  }
})

test('handled navigation is not dispatched again by a nested menu', () => {
  const ui = menu()
  const input = ui.key('Enter', ui.buttons[0])
  menuKeyboard(input)
  menuKeyboard(input)
  assert.equal(ui.buttons[0].clicks, 1)
  assert.equal(input.stopped, true)
})
