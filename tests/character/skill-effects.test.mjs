import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSkillEffects } from '../../src/domain/skills/effects.ts'
import { tradePrice } from '../../src/domain/inventory/trade.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { applyCarriedBonuses } from '../../src/domain/inventory/items.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'
import { RestService } from '../../src/app/services/RestService.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { resolveDifficulty } from '../../src/domain/character/difficulty.ts'
import { detectsHero } from '../../src/domain/combat/patrolCombat.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { content, contentFiles } from '../helpers/content.mjs'

const data = content(), rates = data.skills

test('skill effects use configured rates and capped linear barter sale prices', () => {
  const effects = resolveSkillEffects({ athletics: 10, weapons: 6, martialArts: 8, stealth: 5, medicine: 4, barter: 2 }, rates)
  assert.deepEqual(effects, { movement: 1.5, rangedDamage: 1.3, meleeDamage: 1.4, detection: 0.75,
    recovery: 1.2, buyPrice: 1, sellPrice: 0.1 })
  assert.deepEqual(resolveSkillEffects({}, rates), { movement: 1, rangedDamage: 1, meleeDamage: 1, detection: 1,
    recovery: 1, buyPrice: 1, sellPrice: 0 })
  assert.equal(detectsHero({ x: 200, y: 0 }, { x: 0, y: 0, available: true }, 260 * effects.detection, true), false)
})

test('barter sale prices use full item value, floor per unit and respect the purchase cap', () => {
  for (const [barter, expected] of [[-1, 0], [0, 0], [1, 0], [4, 3], [9, 6], [19, 14], [20, 15], [21, 15], [100, 15]]) {
    const effects = resolveSkillEffects({ barter }, rates)
    assert.equal(tradePrice({ price: 15 }, true, effects), expected)
  }
})

test('vendor payouts match live barter quotes, including zero-skill sales', () => {
  let barter = 4
  const inventory = new InventoryService([{ id: 'goods', price: 15, maxStack: 5 }], [
    { id: 'shop', name: 'Shop', locationId: 'center', vendor: true, items: [] },
  ], () => 0, [{ itemId: 'goods', quantity: 3 }], undefined,
  () => resolveSkillEffects({ barter }, rates))
  inventory.openContainer('shop')
  assert.equal(inventory.getPrice('goods', true), 3)
  inventory.storeItem('goods', 0)
  assert.equal(inventory.getSnapshot().money, 3)
  barter = 1
  assert.equal(inventory.getPrice('goods', true), 0)
  inventory.storeItem('goods', 0)
  assert.equal(inventory.getSnapshot().money, 3)
  barter = 20
  assert.equal(inventory.getPrice('goods', true), 15)
  barter = 0
  assert.equal(inventory.getPrice('goods', true), 0)
  inventory.storeItem('goods', 0)
  assert.equal(inventory.getSnapshot().money, 3)
  assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'goods'), false)
})

test('high Stealth and Barter never produce negative radii/prices or profitable same-price trades', () => {
  for (const points of [0, 1, 5, 10, 15, 20, 100]) {
    const effects = resolveSkillEffects({ stealth: points, barter: points }, rates)
    assert.ok(effects.detection >= 0)
    for (const price of [1, 2, 3, 6, 12, 100]) {
      const buy = tradePrice({ price }, false, effects), sell = tradePrice({ price }, true, effects)
      assert.ok(Number.isInteger(buy) && buy >= 1)
      assert.ok(Number.isInteger(sell) && sell >= 0 && sell <= buy)
    }
    assert.equal(tradePrice({ price: 1 }, true, effects), points >= 20 ? 1 : 0)
  }
  const ten = resolveSkillEffects({ barter: 10 }, rates)
  assert.equal(tradePrice({ price: 10 }, false, ten), 10)
  assert.equal(tradePrice({ price: 6 }, true, ten), 3, 'sale capped to its current purchase price')
})

test('Medicine applies once to difficulty-scaled items, rest/sleep and direct recovery, with accurate previews', () => {
  for (const id of ['easy', 'normal', 'hard']) {
    const rules = resolveDifficulty(data.difficulty, id, { hero: data.hero.settings, stats: data.ui.stats, rest: data.ui.rest, timeCosts: data.daytime.statCostsPerPhase })
    const multiplier = resolveSkillEffects({ medicine: 10 }, rates).recovery
    const status = new StatusService(undefined, () => multiplier)
    status.configure(rules.stats, rules.modifiers.itemRecovery)
    const reset = () => status.restoreState({ health: 0, energy: 0, sanity: 1 })
    reset()
    status.takeDamage(1000)
    const item = { id: 'med', consumable: true, maxStack: 5, recovery: { health: 10, energy: 10, sanity: 10 } }
    const inventory = new InventoryService([item], [], () => 0, [{ itemId: 'med', quantity: 2 }], status)
    const preview = status.getRecovery(status.getItemRecovery(item.recovery))
    inventory.openInventory(); inventory.useItem(0)
    assert.deepEqual(status.getSnapshot(), { ...preview, sanity: preview.sanity + 1 })
    const time = new DayTime(), rest = new RestService(time, status, rules.recovery)
    for (const kind of ['rest', 'sleep']) {
      reset()
      const expected = rest.getRecovery(kind).energy
      rest.open(kind, 'Furniture'); rest.confirm(1)
      assert.equal(status.getSnapshot().energy, Math.min(status.getLimits().energy, expected))
    }
    reset()
    status.recover({ energy: 10 })
    assert.equal(status.getSnapshot().energy, 15)
    status.recover({ energy: 1000 })
    assert.equal(status.getSnapshot().energy, status.getLimits().energy)
  }
})

test('carried skill bonuses immediately update service prices and recovery without changing base skills', () => {
  const classDefinition = contentFiles()['./classes.json'][0]
  const base = createCharacter(classDefinition)
  const item = { id: 'guide', price: 20, bonus: { skill: 'barter', amount: 3 } }
  let inventory
  const effects = () => resolveSkillEffects(applyCarriedBonuses(base, inventory.getSnapshot().items, { guide: item }).skills, rates)
  inventory = new InventoryService([item], [{ id: 'shop', name: 'Shop', locationId: 'center', vendor: true, items: [] }], () => 0, [], undefined, effects)
  inventory.grantItems([], 100)
  const before = inventory.getPrice('guide')
  const saleBefore = inventory.getPrice('guide', true)
  inventory.grantItems([{ itemId: 'guide', quantity: 1 }])
  assert.equal(inventory.getPrice('guide'), before)
  assert.ok(inventory.getPrice('guide', true) > saleBefore)
  inventory.openContainer('shop')
  const sell = inventory.getPrice('guide', true), money = inventory.getSnapshot().money
  inventory.storeItem('guide')
  assert.equal(inventory.getSnapshot().money, money + sell)
  assert.equal(inventory.getPrice('guide'), before)
  assert.equal(base.skills.barter, classDefinition.attributes.charisma * 2 + classDefinition.attributes.willpower)
})

test('negative and unknown skill-effect configuration fields fail validation', () => {
  const invalid = content()
  invalid.skills.medicine = -0.05
  assert.throws(() => validateContent(invalid), /medicine/)
  const typo = content()
  typo.skills.weapon = 0.05
  assert.throws(() => validateContent(typo), /weapon/)
})
