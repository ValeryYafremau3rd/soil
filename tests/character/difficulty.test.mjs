import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveDifficulty, patrolDifficulty, patrolMovementDifficulty } from '../../src/domain/character/difficulty.ts'
import { fallDamage } from '../../src/domain/movement/fallDamage.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { RestService } from '../../src/app/services/world/RestService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { drainStatusWithTime } from '../../src/app/services/character/drainStatusWithTime.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { content, catalogue } from '../helpers/content.mjs'

const data = content()
const base = { hero: data.hero.settings, stats: data.ui.stats, rest: data.ui.rest, timeCosts: data.daytime.statCostsPerPhase }
const rules = id => resolveDifficulty(data.difficulty, id, base)

test('percentage phase drain preserves difficulty scaling and day rollover', () => {
  for (const [id, energy, sanity] of [['easy', 3, 5], ['normal', 5, 5], ['hard', 8, 10]]) {
    const selected = rules(id)
    assert.ok(Math.abs(selected.timeCosts.energy - energy) < 1e-10)
    assert.equal(selected.timeCosts.sanity, sanity)
    const time = new DayTimeService(1, 'night')
    const status = new StatusService()
    status.restoreState({ health: 50, energy: 50, sanity: 50 })
    const stop = drainStatusWithTime(time, status, selected.timeCosts)
    time.advance()
    assert.equal(time.getSnapshot().day, 2)
    assert.equal(status.getSnapshot().energy, 50 - energy)
    assert.equal(status.getSnapshot().sanity, 50 - sanity)
    stop()
  }
})

test('phase drain stays active above and below fifty percent Energy', () => {
  for (const energy of [80, 50, 20]) {
    const time = new DayTimeService()
    const status = new StatusService()
    status.restoreState({ health: 50, energy, sanity: 50 })
    const stop = drainStatusWithTime(time, status, rules('normal').timeCosts)
    time.advance()
    assert.equal(status.getSnapshot().energy, energy - 5)
    assert.equal(status.getSnapshot().sanity, 45)
    stop()
  }
})

test('three configured presets exist and Normal preserves current gameplay balance', () => {
  assert.deepEqual(data.difficulty.presets.map(preset => preset.id), ['easy', 'normal', 'hard'])
  assert.equal(data.difficulty.defaultId, 'normal')
  const normal = rules('normal')
  assert.deepEqual(normal.hero, base.hero)
  assert.deepEqual(normal.stats, base.stats)
  assert.deepEqual(normal.timeCosts, base.timeCosts)
  assert.deepEqual(normal.recovery.rest, { health: 15, energy: 15, sanity: 0 })
  assert.deepEqual(normal.recovery.sleep, { health: 50, energy: 50, sanity: 20 })
  assert.deepEqual(patrolDifficulty(data.patrols.types.patrol.combat, normal), {
    ...data.patrols.types.patrol.combat, chaseSpeed: data.patrols.types.patrol.combat.chaseSpeed * 0.8,
  })
})

test('Easy and Hard change all configured damage, patrol, recovery and time modifiers consistently', () => {
  const easy = rules('easy'), normal = rules('normal'), hard = rules('hard')
  assert.ok(easy.hero.meleeDamage > normal.hero.meleeDamage && hard.hero.meleeDamage < normal.hero.meleeDamage)
  assert.ok(easy.hero.shotDamage > normal.hero.shotDamage && hard.hero.shotDamage < normal.hero.shotDamage)
  assert.ok(fallDamage(300, easy.hero.fallDamage) < fallDamage(300, normal.hero.fallDamage))
  assert.ok(fallDamage(300, hard.hero.fallDamage) > fallDamage(300, normal.hero.fallDamage))
  for (const key of ['health', 'meleeDamage']) {
    const config = data.patrols.types.patrol.combat
    assert.ok(patrolDifficulty(config, easy)[key] < config[key])
    assert.ok(patrolDifficulty(config, hard)[key] > config[key])
  }
  assert.ok(easy.recovery.rest.health > normal.recovery.rest.health && hard.recovery.rest.health < normal.recovery.rest.health)
  assert.ok(easy.recovery.sleep.health > normal.recovery.sleep.health && hard.recovery.sleep.health < normal.recovery.sleep.health)
  for (const selected of [easy, normal, hard]) {
    for (const stat of selected.stats) assert.equal(stat.value, stat.max)
  }
  assert.deepEqual(easy.timeCosts, { energy: 3, sanity: 5 })
  assert.ok(Math.abs(hard.timeCosts.energy - 8) < 1e-10)
  assert.equal(hard.timeCosts.sanity, 10)
})

test('militia speed uses the authored Hard baseline and detection uses the Normal baseline', () => {
  const definition = data.patrols.types.patrol
  for (const [id, speed, detection] of [['easy', 0.6, 0.9], ['normal', 0.8, 1], ['hard', 1, 1.1]]) {
    const combat = patrolDifficulty(definition.combat, rules(id), definition.kind)
    assert.equal(combat.chaseSpeed, definition.combat.chaseSpeed * speed)
    assert.equal(combat.detectionRadius, definition.combat.detectionRadius * detection)
    assert.equal(patrolMovementDifficulty(definition.movement, rules(id), definition.kind).speed, definition.movement.speed * speed)
  }
})

test('all monster types scale independently of militia modifiers and preserve Normal parameters', () => {
  for (const definition of Object.values(data.patrols.types).filter(entry => entry.kind === 'monster')) {
    for (const [id, scale] of [['easy', 0.9], ['normal', 1], ['hard', 1.1]]) {
      const original = structuredClone(definition)
      const combat = patrolDifficulty(definition.combat, rules(id), definition.kind)
      for (const key of ['health', 'meleeDamage']) assert.equal(combat[key], Math.round(definition.combat[key] * scale))
      for (const key of ['chaseSpeed', 'detectionRadius', 'meleeRange']) assert.equal(combat[key], definition.combat[key] * scale)
      for (const key of ['attackCooldownMs', 'reactionDelayMs']) assert.equal(combat[key], definition.combat[key] / scale)
      assert.equal(combat.fear.radius, definition.combat.fear.radius * scale)
      assert.equal(combat.fear.sanityPerSecond, definition.combat.fear.sanityPerSecond * scale)
      assert.equal(combat.fear.noticeSanityDamage, Math.round(definition.combat.fear.noticeSanityDamage * scale))
      assert.equal(patrolMovementDifficulty(definition.movement, rules(id), definition.kind).speed, definition.movement.speed * scale)
      if (id === 'normal') assert.deepEqual(combat, definition.combat)
      assert.deepEqual(definition, original)
    }
  }
})

test('configured limits replace hardcoded caps and preview initial values match the clamped result', () => {
  const custom = structuredClone(data.difficulty)
  const easy = custom.presets.find(preset => preset.id === 'easy')
  easy.modifiers.maximumStats = 0.5
  const selected = resolveDifficulty(custom, 'easy', base)
  assert.equal(selected.stats[0].value, 50)
  const status = new StatusService()
  status.configure(selected.stats, easy.modifiers.itemRecovery)
  status.recover({ health: 500, energy: 500, sanity: 500 })
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 50, sanity: 50 })
  assert.deepEqual(status.getLimits(), { health: 50, energy: 50, sanity: 50 })
  status.configure([{ id: 'health', value: 150, max: 200 }, { id: 'energy', value: 80, max: 120 }, { id: 'sanity', value: 60, max: 90 }], 1)
  status.recover({ health: 500, energy: 500, sanity: 500 })
  assert.deepEqual(status.getSnapshot(), { health: 200, energy: 120, sanity: 90 })
})

test('consumable recovery matches the selected preset without changing item config or quantity rules', () => {
  for (const [id, expected] of [['easy', 38], ['normal', 30], ['hard', 23]]) {
    const selected = rules(id), status = new StatusService()
    status.configure(selected.stats, selected.modifiers.itemRecovery)
    status.takeDamage(status.getSnapshot().health - 1)
    const medicine = data.items.find(item => item.id === 'medicine')
    const inventory = new InventoryService([medicine], [], () => 0, [{ itemId: medicine.id, quantity: 2 }], status,
      undefined, undefined, undefined, () => medicine.eruditionRequired, false, undefined, undefined, () => ({ medicine: 6 }))
    inventory.openInventory()
    inventory.useItem(0)
    assert.equal(status.getSnapshot().health, 1 + expected)
    assert.equal(inventory.getSnapshot().items[0].quantity, 1)
    assert.equal(medicine.recovery.health, 30)
  }
})

test('rest, sleep and time costs support all vitals and selected presets', () => {
  for (const id of ['easy', 'normal', 'hard']) {
    const selected = rules(id), time = new DayTimeService(), status = new StatusService()
    status.configure(selected.stats, selected.modifiers.itemRecovery)
    const rest = new RestService(time, status, selected.recovery)
    drainStatusWithTime(time, status, selected.timeCosts, () => rest.isAdvancingTime)
    rest.open('rest', 'Bench'); rest.confirm()
    assert.equal(status.getSnapshot().energy, Math.min(selected.stats[1].max, selected.stats[1].value + selected.recovery.rest.energy))
    assert.equal(status.getSnapshot().sanity, selected.stats[2].value - selected.timeCosts.sanity)
    assert.equal(status.getSnapshot().health, Math.min(selected.stats[0].max, selected.stats[0].value + selected.recovery.rest.health))
  }
  const status = new StatusService(), rest = new RestService(new DayTimeService(), status, { rest: { energy: 10, sanity: 5 }, sleep: { energy: 25 } })
  status.restoreState({ health: 50, energy: 50, sanity: 50 })
  rest.open('rest', 'Bench'); rest.confirm()
  assert.deepEqual(status.getSnapshot(), { health: 50, energy: 60, sanity: 55 })
})

test('rest and sleep recover Energy for every difficulty and phase without charging elapsed Energy costs', () => {
  for (const id of ['easy', 'normal', 'hard']) {
    const selected = rules(id)
    for (const phase of ['morning', 'afternoon', 'evening', 'night']) {
      for (const kind of ['rest', 'sleep']) {
        const time = new DayTimeService(2, phase), status = new StatusService()
        status.configure(selected.stats, selected.modifiers.itemRecovery)
        status.drain({ energy: status.getSnapshot().energy - 10 })
        const rest = new RestService(time, status, selected.recovery)
        drainStatusWithTime(time, status, selected.timeCosts, () => rest.isAdvancingTime)
        const before = status.getSnapshot()
        rest.open(kind, 'Furniture'); rest.close(); rest.confirm()
        assert.deepEqual(status.getSnapshot(), before, 'cancel does not recover or charge')
        rest.open(kind, 'Furniture'); rest.confirm()
        const ticks = kind === 'sleep' ? 4 - ['morning', 'afternoon', 'evening', 'night'].indexOf(phase) : 1
        const recovery = selected.recovery[kind].energy * (kind === 'sleep' ? status.getLimits().energy / 100 * ticks : 1)
        const expected = Math.min(status.getLimits().energy, 10 + recovery)
        assert.equal(status.getSnapshot().energy, expected, `${id} ${phase} ${kind}`)
        const after = status.getSnapshot()
        rest.confirm()
        assert.deepEqual(status.getSnapshot(), after, 'duplicate confirmation does nothing')
        time.advance()
        assert.equal(status.getSnapshot().energy, Math.max(0, expected - selected.timeCosts.energy), 'later time advancement charges exactly one phase')
      }
    }
    const time = new DayTimeService(), status = new StatusService()
    status.configure(selected.stats, selected.modifiers.itemRecovery)
    status.recover({ energy: 1000 })
    const rest = new RestService(time, status, selected.recovery)
    drainStatusWithTime(time, status, selected.timeCosts, () => rest.isAdvancingTime)
    for (const kind of ['rest', 'sleep']) {
      rest.open(kind, 'Furniture'); rest.confirm()
      assert.equal(status.getSnapshot().energy, status.getLimits().energy, 'maximum Energy stays full during recovery')
    }
  }
})

test('unknown presets and malformed difficulty config fail clearly', () => {
  assert.throws(() => rules('missing'), /Unknown difficulty/)
  for (const [mutate, pattern] of [
    [data => { data.difficulty.defaultId = 'missing' }, /defaultId/],
    [data => { data.difficulty.presets.pop() }, /three presets/],
    [data => { data.difficulty.presets[0].id = 'normal' }, /unique/],
    [data => { data.difficulty.presets[0].modifiers.patrolDamage = -1 }, /patrolDamage/],
    [data => { data.difficulty.presets[0].modifiers.monsterStrength = 0 }, /monsterStrength/],
    [data => { delete data.difficulty.presets[0].modifiers.itemRecovery }, /itemRecovery/],
    [data => { data.difficulty.presets[0].modifiers.typo = 1 }, /typo/],
  ]) {
    const { data, sources } = catalogue()
    mutate(data)
    assert.throws(() => validateContent(data, sources), pattern)
  }
})
