import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { emptyPerks, progressForAction } from '../../src/domain/character/perks.ts'
import { PatrolPerkTracker } from '../../src/domain/combat/patrolCombat/encounters.ts'

const data = content()
test('training ignores early actions, saves parallel progress and awards its perk once', () => {
  let perks = emptyPerks()
  let rewards = 0
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const quests = new QuestService(data.quests, inventory, () => {}, undefined, Math.random, id => {
    if (id !== 'well-trained') return
    rewards++
    perks = progressForAction(perks, data.ui.perks, 'wellTrainedFinished')
  })
  quests.startInitialQuests()
  quests.recordAction('gunDefeat')
  quests.recordAction('workAsked')
  quests.recordAction('objectHidden')
  quests.recordAction('meleeDefeat')
  quests.recordAction('meleeDefeat')
  quests.restoreState(quests.getSnapshot().progress)
  assert.equal(quests.isCompleted('well-trained'), false)
  quests.recordAction('gunDefeat')
  quests.recordAction('gunDefeat')
  assert.equal(quests.isCompleted('well-trained'), true)
  assert.equal(rewards, 1)
  assert.ok(perks.acquired.includes('well-trained'))
  assert.deepEqual(data.ui.perks.find(p => p.id === 'well-trained').skillModifiers,
    { weapons: 1, martialArts: 1, stealth: 1 })
})

test('hiding earns training credit only after an active chase', () => {
  const tracker = new PatrolPerkTracker()
  const state = { alive: true, visible: true, hidden: true, inRange: true, detected: false }
  assert.equal(tracker.observe('enemy', state).includes('chaseHidden'), false)
  tracker.observe('enemy', { ...state, hidden: false, detected: true })
  assert.ok(tracker.observe('enemy', state).includes('chaseHidden'))
  assert.equal(tracker.observe('enemy', state).includes('chaseHidden'), false)
  tracker.observe('enemy', { ...state, hidden: false, detected: true })
  tracker.cancelChases()
  assert.equal(tracker.observe('enemy', state).includes('chaseHidden'), false)
})

test('chase credit alone does not replace hiding behind an object for training', () => {
  const inventory = new InventoryService(data.items, [], () => 0, [])
  const quests = new QuestService(data.quests, inventory)
  quests.startInitialQuests()
  quests.recordAction('workAsked')
  const tracker = new PatrolPerkTracker()
  const state = { alive: true, visible: true, hidden: false, inRange: true, detected: true }
  tracker.observe('patrol', state)
  assert.deepEqual(tracker.observe('patrol', {
    ...state, detected: false, inRange: false,
  }), ['policeEscaped'])
  for (let frame = 0; frame < 5; frame++) tracker.observe('patrol', {
    ...state, detected: false, inRange: false,
  })
  const hidden = { ...state, detected: false, inRange: false, hidden: true }
  const actions = tracker.observe('patrol', hidden)
  assert.deepEqual(actions, ['chaseHidden'])
  for (const action of actions) quests.recordAction(action)
  const progress = () => quests.getSnapshot().progress
    .find(entry => entry.questId === 'well-trained')
  assert.equal(progress().completedStageIds?.includes('hide') ?? false, false)
  quests.recordAction('objectHidden')
  assert.ok(progress().completedStageIds.includes('hide'))
  assert.deepEqual(tracker.observe('patrol', hidden), [])
})

test('dead, absent or previous-area pursuers cannot award delayed hiding credit', () => {
  const state = { alive: true, visible: true, hidden: false, inRange: true, detected: true }
  for (const end of [{ alive: false }, { visible: false }, null]) {
    const tracker = new PatrolPerkTracker()
    tracker.observe('patrol', state)
    tracker.observe('patrol', { ...state, detected: false, inRange: false })
    if (end) tracker.observe('patrol', { ...state, detected: false, ...end })
    else tracker.cancelChases()
    assert.deepEqual(tracker.observe('patrol', {
      ...state, detected: false, hidden: true, inRange: false,
    }), [])
  }
})
