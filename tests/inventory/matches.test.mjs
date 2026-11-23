import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { createCharacter, calculateSkills } from '../../src/domain/skills/character.ts'
import { perkCharacter } from '../../src/domain/character/perks.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { PerksService } from '../../src/app/services/character/PerksService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'

test('matches stack to five, consume one, refresh tradeoffs and expire after four phases', () => {
  const { items, ui } = content()
  const time = new DayTimeService(1, 'morning')
  const status = new StatusService()
  const perks = new PerksService(ui.perks, time, status, undefined, undefined, ui.consumableBuffs)
  status.setItemEffects(perks)
  const inventory = new InventoryService(items, [], () => 20, [{ itemId: 'matches', quantity: 6 }], status, undefined, undefined, undefined, () => 20)
  assert.deepEqual(inventory.getSnapshot().items.map(item => item.quantity), [5, 1])
  const character = createCharacter({ id: 'test', name: 'Test', attributes: {
    strength: 5, agility: 5, intelligence: 5, willpower: 5, charisma: 5,
  }, startingItems: [] })
  const effective = () => perkCharacter(character, perks.getSnapshot(), ui.consumableBuffs)
  inventory.openInventory()
  inventory.useItem(0)
  assert.equal(inventory.getSnapshot().items[0].quantity, 4)
  assert.equal(effective().attributes.agility, 6)
  assert.equal(effective().skills.stealth, calculateSkills(effective().attributes).stealth - 2)
  time.advance()
  inventory.openInventory()
  inventory.useItem(0)
  assert.equal(effective().attributes.agility, 6)
  assert.equal(effective().skillModifiers.stealth, -2)
  for (let phase = 0; phase < 3; phase++) time.advance()
  assert.equal(effective().attributes.agility, 6)
  time.advance()
  assert.equal(effective().attributes.agility, 5)
  assert.equal(effective().skillModifiers.stealth, undefined)
  inventory.useItem(0)
  perks.clearTimedEffects()
  assert.equal(effective().attributes.agility, 5)
})
