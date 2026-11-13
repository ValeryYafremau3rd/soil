import test from 'node:test'
import assert from 'node:assert/strict'
import { LockpickingService } from '../../src/app/services/LockpickingService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { matchesLock } from '../../src/domain/buildings/lockpicking.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { content } from '../helpers/content.mjs'
import classes from '../../src/content/classes.json' with { type: 'json' }
import { MessageService } from '../../src/app/services/MessageService.ts'

function setup(skill = 0, random = () => 0) {
  let now = 1000
  const time = new DayTime(1, 'night')
  const messages = new MessageService()
  const inventory = new InventoryService([{ id: 'lockpick', consumable: true, maxStack: 3 }], [], () => 0, [{ itemId: 'lockpick', quantity: 3 }])
  const locks = new LockpickingService(time, () => skill, { lockpickingBaseSeconds: 10, lockpickingSecondsPerPoint: 1 },
    { has: () => inventory.getSnapshot().items.some(item => item.itemId === 'lockpick'), consume: () => inventory.consumeItem('lockpick') }, () => now, random, messages.show)
  return { locks, time, inventory, messages, advance: value => { now += value } }
}

test('lockpicks require education or practical training and remain intact on rejection', () => {
  const pick = content().items.find(item => item.id === 'lockpick')
  let erudition = pick.eruditionRequired - 1
  const messages = []
  const inventory = new InventoryService([pick], [], () => 0, [{ itemId: 'lockpick', quantity: 2 }],
    undefined, undefined, undefined, text => messages.push(text), () => erudition, false, undefined, undefined, () => ({ lockpicking: 1 }))
  const locks = new LockpickingService(new DayTime(1, 'night'), () => 0,
    { lockpickingBaseSeconds: 10, lockpickingSecondsPerPoint: 1 },
    { has: () => true, canUse: () => inventory.canUseItem('lockpick'), consume: () => inventory.consumeItem('lockpick') })
  locks.attempt('door', 'Door')
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  assert.match(messages[0], new RegExp(`Requires Erudition ${pick.eruditionRequired}`))
  erudition = pick.eruditionRequired
  locks.attempt('door', 'Door')
  assert.ok(locks.getSnapshot().puzzle)
  locks.close()
  assert.equal(inventory.getSnapshot().items[0].quantity, 1)
})

test('Safecracker starts with three consumable lockpicks without a skill bonus; stacks cap at three', () => {
  const items = content().items
  const pick = items.find(item => item.id === 'lockpick')
  assert.equal(pick.bonus, undefined)
  assert.equal(pick.consumable, true)
  assert.equal(pick.maxStack, 3)
  const pliers = items.find(item => item.id === 'pliers')
  assert.equal(pliers.name, 'Pliers')
  assert.deepEqual(pliers.bonus, { skill: 'lockpicking', amount: 2 })
  assert.equal(pliers.consumable, undefined)
  assert.equal(pliers.maxStack, undefined)
  const safecracker = classes[1]
  assert.equal(safecracker.id, 'safecracker')
  assert.deepEqual(safecracker.startingItems, ['lockpick', 'lockpicking-training-magazine', 'red-cigarettes', 'key-ring', 'money'])
  const inventory = new InventoryService(items, [], () => 0,
    safecracker.startingItems.map(itemId => ({ itemId, quantity: safecracker.startingItemQuantities?.[itemId] ?? 1 })))
  assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId === 'lockpick'), [{ itemId: 'lockpick', quantity: 3 }])
  inventory.grantItems([{ itemId: 'lockpick', quantity: 1 }])
  assert.deepEqual(inventory.getSnapshot().items.filter(item => item.itemId === 'lockpick').map(item => item.quantity), [3, 1])
  inventory.grantItems([{ itemId: 'lockpick', quantity: 2 }])
  assert.throws(() => inventory.grantItems([{ itemId: 'lockpick', quantity: 1 }]), /six slots/)
  inventory.openInventory()
  inventory.useItem(inventory.getSnapshot().items.findIndex(item => item.itemId === 'lockpick'))
  assert.equal(inventory.getSnapshot().items.find(item => item.itemId === 'lockpick').quantity, 3, 'inventory Enter does not waste lockpicks')
  assert.equal(inventory.consumeItem('screwdriver'), false)
  assert.equal(inventory.consumeItem('pliers'), false)
})

test('apartment doors lock throughout the day while building entrances lock only at night', () => {
  const { locks, time } = setup()
  assert.equal(locks.isLocked('house'), true)
  assert.equal(locks.isLocked('house:21', 'apartment-21'), true)
  assert.equal(locks.isLocked('house:12', 'apartment-12'), true)
  time.nextMorning()
  assert.equal(locks.isLocked('house:21', 'apartment-21'), true)
  assert.equal(locks.isLocked('house:12', 'apartment-12'), true)
  assert.equal(locks.attempt('house', 'House'), true)
  assert.equal(locks.getSnapshot().puzzle, null)
})

test('daytime apartment lockpicking preserves keys and unlocks only until the next day', () => {
  const { locks, time, inventory } = setup()
  time.nextMorning()
  assert.equal(locks.attempt('house:12', 'Apartment 12', 'apartment-12'), false)
  assert.ok(locks.getSnapshot().puzzle)
  locks.setNumber(0, 2)
  locks.submit()
  assert.equal(locks.isLocked('house:12', 'apartment-12'), false)
  assert.equal(locks.isLocked('house:22', 'apartment-22'), true)
  assert.equal(inventory.getSnapshot().items[0].quantity, 3)
  time.advance()
  assert.equal(locks.attempt('house:12', 'Apartment 12', 'apartment-12'), true)
  time.nextMorning()
  assert.equal(locks.isLocked('house:12', 'apartment-12'), true)
})

test('new attempts roll three independent digits from 1 to 9', () => {
  const draws = [0, 0, 0.5, 0.999, 0, 0.999, 0, 0.5]
  const { locks } = setup(0, () => draws.shift())
  locks.attempt('door', 'Door')
  assert.deepEqual(locks.getSnapshot().puzzle.numbers, [1, 5, 9])
  locks.close()
  locks.attempt('door', 'Door')
  assert.deepEqual(locks.getSnapshot().puzzle.numbers, [9, 1, 5])
})

test('a random starting solution is adjusted to keep the door locked', () => {
  const draws = [0.5, 0, 0.5, 0.999]
  const { locks } = setup(0, () => draws.shift())
  locks.attempt('door', 'Door')
  const puzzle = locks.getSnapshot().puzzle
  assert.equal(puzzle.target, 15)
  assert.deepEqual(puzzle.numbers, [2, 5, 9])
  assert.equal(matchesLock(puzzle.numbers, puzzle.target), false)
  assert.equal(locks.isLocked('door'), true)
})

test('valid solution unlocks only the chosen door for that night', () => {
  const { locks, time, inventory, messages } = setup()
  locks.attempt('door', 'Door')
  locks.setNumber(0, 2)
  assert.ok(locks.getSnapshot().puzzle, 'matching digits wait for confirmation')
  assert.equal(locks.isLocked('door'), true)
  locks.submit()
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.match(messages.getSnapshot().messages.at(-1).text, /successful/)
  assert.equal(messages.getSnapshot().messages.at(-1).presentation, 'success')
  assert.equal(inventory.getSnapshot().items[0].quantity, 3)
  assert.equal(locks.attempt('door', 'Door'), true)
  assert.equal(locks.isLocked('other'), true)
  locks.submit()
  time.nextMorning()
  for (let i = 0; i < 3; i++) time.advance()
  assert.equal(locks.isLocked('door'), true)
})

test('skill extends deadline; timeout closes the puzzle and rejects late matching input', () => {
  const { locks, advance } = setup(5)
  locks.attempt('door', 'Door')
  assert.equal(locks.getSnapshot().puzzle.deadline, 16000)
  advance(15000)
  locks.setNumber(0, 2)
  locks.submit()
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.equal(locks.isLocked('door'), true)
  locks.close()
  locks.attempt('door', 'Door')
  assert.equal(locks.getSnapshot().puzzle.failed, false)
})

test('timer tick closes the window without unlocking the door', () => {
  const { locks, advance, inventory, messages } = setup()
  locks.attempt('door', 'Door')
  advance(10000)
  locks.tick()
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.equal(locks.isLocked('door'), true)
  assert.match(messages.getSnapshot().messages.at(-1).text, /failed/)
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  locks.tick()
  locks.close()
  assert.equal(inventory.getSnapshot().items[0].quantity, 2, 'failure spends exactly one')
})

test('cancelling consumes one lockpick and no lockpicks blocks further attempts', () => {
  const { locks, inventory, messages } = setup()
  for (let i = 0; i < 3; i++) {
    locks.attempt('door', 'Door')
    locks.close()
  }
  assert.deepEqual(inventory.getSnapshot().items, [])
  assert.equal(locks.attempt('door', 'Door'), false)
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.match(messages.getSnapshot().messages.at(-1).text, /required/)
  assert.equal(locks.isLocked('door'), true)
  const message = messages.getSnapshot().messages.at(-1)
  messages.dismiss(message.id)
  assert.equal(messages.getSnapshot().messages.some(entry => entry.id === message.id), false)
})

test('cancel, repeated attempts, wrong sums and invalid digits preserve the lock', () => {
  const { locks, inventory, messages } = setup()
  locks.attempt('door', 'Door')
  const puzzle = locks.getSnapshot().puzzle
  locks.attempt('other', 'Other')
  assert.equal(locks.getSnapshot().puzzle, puzzle)
  locks.setNumber(0, 10)
  assert.equal(locks.getSnapshot().puzzle, puzzle)
  locks.submit()
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.equal(inventory.getSnapshot().items[0].quantity, 2)
  assert.match(messages.getSnapshot().messages.at(-1).text, /One lockpick broke/)
  locks.submit()
  locks.close()
  locks.tick()
  assert.equal(inventory.getSnapshot().items[0].quantity, 2, 'repeated input cannot spend another lockpick after failure')
  assert.equal(locks.isLocked('door'), true)
  assert.equal(matchesLock([0, 5, 9], 14), false)
  assert.equal(matchesLock([1, 4, 9], 14), true)
})

test('wrong submissions exhaust the supply and cannot reopen a puzzle without a lockpick', () => {
  const { locks, inventory, messages } = setup()
  for (let attempt = 0; attempt < 3; attempt++) {
    locks.attempt('door', 'Door')
    locks.submit()
    assert.equal(locks.getSnapshot().puzzle, null)
    assert.equal(locks.isLocked('door'), true)
  }
  assert.deepEqual(inventory.getSnapshot().items, [])
  locks.attempt('door', 'Door')
  assert.equal(locks.getSnapshot().puzzle, null)
  assert.match(messages.getSnapshot().messages.at(-1).text, /lockpick is required/)
})
