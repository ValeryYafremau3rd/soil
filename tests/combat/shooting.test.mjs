import assert from 'node:assert/strict'
import test from 'node:test'
import { spendShot } from '../../src/domain/combat/shooting.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue, content } from '../helpers/content.mjs'

const definitions = content().items
const rules = Object.fromEntries(definitions.map(item => [item.id, item]))
const stack = (itemId, quantity = 1) => ({ itemId, quantity })

test('shooting requires a carried gun and compatible ammunition', () => {
  for (const items of [[], [stack('pistol-ammunition', 5)], [stack('revolver')],
    [stack('crowbar'), stack('pistol-ammunition')], [stack('compact-pistol'), stack('shotgun-shells', 5)]]) {
    assert.equal(spendShot(items, rules), items)
  }
  for (const gun of ['compact-pistol', 'service-pistol', 'revolver']) {
    const items = [stack(gun), stack('pistol-ammunition', 5), stack('shotgun-shells', 3)]
    const result = spendShot(items, rules)
    assert.deepEqual(result, [stack(gun), stack('pistol-ammunition', 4), stack('shotgun-shells', 3)])
    assert.equal(items[1].quantity, 5, 'original inventory is immutable')
  }
})

test('preparation eligibility explains missing equipment and checks matching ammunition without spending it', () => {
  for (const [items, message] of [
    [[], /need a gun/],
    [[stack('pistol-ammunition')], /need a gun/],
    [[stack('service-pistol')], /No compatible ammunition/],
    [[stack('service-pistol'), stack('shotgun-shells')], /No compatible ammunition/],
  ]) {
    const messages = []
    const service = new InventoryService(definitions, [], () => 0, items, undefined, undefined, undefined, text => messages.push(text), () => 20, false, undefined, undefined, () => ({ weapons: 30 }))
    const before = service.getSnapshot()
    assert.equal(service.canShoot(), false)
    assert.equal(service.getSnapshot(), before)
    assert.match(messages[0], message)
  }
  const service = new InventoryService(definitions, [], () => 0, [stack('service-pistol'), stack('pistol-ammunition')], undefined, undefined, undefined, undefined, () => 20, false, undefined, undefined, () => ({ weapons: 30 }))
  const before = service.getSnapshot()
  assert.equal(service.canShoot(), true)
  assert.equal(service.canShoot(), true)
  assert.equal(service.getSnapshot(), before, 'starting preparation spends no bullets and publishes no inventory change')
  assert.equal(service.tryShoot(), true)
  assert.equal(service.canShoot(), false, 'the last bullet cannot start another preparation')
})

test('the last bullet releases its slot, and later shots continue in the next stack', () => {
  const service = new InventoryService(definitions, [], () => 0, [stack('compact-pistol'), stack('pistol-ammunition', 6)],
    undefined, undefined, undefined, undefined, () => 20, false, undefined, undefined, () => ({ weapons: 30 }))
  for (let shot = 0; shot < 6; shot++) assert.equal(service.tryShoot(), true)
  assert.deepEqual(service.getSnapshot().items, [stack('compact-pistol')])
  const empty = service.getSnapshot()
  assert.equal(service.tryShoot(), false)
  assert.equal(service.getSnapshot(), empty)
})

test('failed shots publish nothing; successful shots publish exactly once', () => {
  const service = new InventoryService(definitions, [], () => 0, [stack('pistol-ammunition', 2)],
    undefined, undefined, undefined, undefined, () => 20, false, undefined, undefined, () => ({ weapons: 30 }))
  let calls = 0
  service.subscribe(() => { calls++ })
  assert.equal(service.tryShoot(), false)
  assert.equal(calls, 0)
  service.grantItems([stack('service-pistol')])
  calls = 0
  assert.equal(service.tryShoot(), true)
  assert.equal(calls, 1)
  service.openInventory()
  const before = service.getSnapshot()
  assert.equal(service.tryShoot(), false)
  assert.equal(service.getSnapshot(), before)
})

test('guns and ammunition in a container are not available until taken', () => {
  const service = new InventoryService(definitions, [{ id: 'crate', name: 'Crate', locationId: 'test',
    items: [stack('compact-pistol'), stack('pistol-ammunition', 2)] }], () => 0, [],
    undefined, undefined, undefined, undefined, () => 20, false, undefined, undefined, () => ({ weapons: 30 }))
  assert.equal(service.tryShoot(), false)
  service.openContainer('crate')
  service.takeAll()
  assert.equal(service.tryShoot(), false, 'container menu blocks shooting')
  service.closeMenu()
  assert.equal(service.tryShoot(), true)
  service.openContainer('crate')
  service.storeItem('compact-pistol')
  service.closeMenu()
  assert.equal(service.tryShoot(), false)
})

test('gun selection skips an unloaded gun when another gun has compatible ammunition', () => {
  const alternate = { ...rules, 'other-gun': { id: 'other-gun', firearm: { ammunitionId: 'other-rounds' } } }
  const items = [stack('other-gun'), stack('revolver'), stack('pistol-ammunition')]
  assert.deepEqual(spendShot(items, alternate), [stack('other-gun'), stack('revolver')])
})

test('authored weapons block use below both alternatives and allow education or training', () => {
  for (const id of ['compact-pistol', 'service-pistol', 'revolver']) {
    const required = rules[id].eruditionRequired
    let erudition = required - 1
    let weapons = 1
    const messages = []
    const service = new InventoryService(definitions, [], () => 0, [stack(id), stack('pistol-ammunition', 2)],
      undefined, undefined, undefined, text => messages.push(text), () => erudition, false, undefined, undefined, () => ({ weapons }))
    const before = service.getSnapshot()
    assert.equal(service.tryShoot(), false, id)
    assert.equal(service.getSnapshot(), before)
    assert.match(messages[0], new RegExp(`Requires Erudition ${required}`))
    erudition = required
    assert.equal(service.tryShoot(), true, id)
    assert.equal(service.getSnapshot().items[1].quantity, 1)
    erudition = 1
    weapons = 30
    assert.equal(service.tryShoot(), true, `${id}: training bypasses education`)
  }
})

test('ammunition requirements are enforced independently of the weapon requirement', () => {
  const items = [{ id: 'gun', eruditionRequired: 3, firearm: { ammunitionId: 'round' } },
    { id: 'round', eruditionRequired: 7, ammunition: true, consumable: true }]
  let erudition = 6
  const messages = []
  const service = new InventoryService(items, [], () => 0, [stack('gun'), stack('round')],
    undefined, undefined, undefined, text => messages.push(text), () => erudition, false, undefined, undefined, () => ({ weapons: 30 }))
  assert.equal(service.tryShoot(), false)
  assert.equal(service.getSnapshot().items.length, 2)
  assert.match(messages[0], /Requires Erudition 7/)
  erudition = 7
  assert.equal(service.tryShoot(), true)
})

test('weapon configuration validates ammunition references and prevents recovery ammunition', () => {
  for (const [id, patch] of [
    ['revolver', { firearm: { ammunitionId: 'missing' } }],
    ['revolver', { firearm: { ammunitionId: 'bread' } }],
    ['pistol-ammunition', { consumable: false }],
    ['pistol-ammunition', { recovery: { energy: 10 } }],
  ]) {
    const { data, sources } = catalogue()
    Object.assign(data.items.find(item => item.id === id), patch)
    assert.throws(() => validateContent(data, sources), /ammunition/)
  }
})
