import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { buildVendorSeeds } from '../../src/app/content/vendorSeeds.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { refreshContainersEachMorning } from '../../src/app/services/refreshContainersEachMorning.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'

test('Dusan offers his complete stock from the first conversation without completed quests', () => {
  const data = content()
  const definition = data.dialogues['citizen-mechanic']
  const seed = buildVendorSeeds({ dusan: definition }, data.items)[0]
  assert.equal(seed.requiresQuest, undefined)
  const inventory = new InventoryService(data.items, [seed])
  const dialogue = new DialogueService(inventory.openContainer, {
    isCompleted: () => false, canChoose: () => false, choose: () => false,
  })
  for (let visit = 0; visit < 2; visit++) {
    dialogue.openDialogue('Dusan', definition, 'citizen-mechanic')
    assert.ok(dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'smuggler-trade'))
    dialogue.chooseReply('smuggler-trade')
    assert.equal(inventory.getSnapshot().menu.containerId, seed.id)
    assert.deepEqual(inventory.getSnapshot().containers[seed.id].items, seed.items)
    inventory.closeMenu()
  }
})

test('vendors roll goods only from their configured categories with guaranteed staples and bounded quantities', () => {
  const data = content()
  for (const roll of [0, 0.5, 0.999]) {
    const seeds = buildVendorSeeds(data.dialogues, data.items)
    const inventory = new InventoryService(data.items, seeds, () => roll)
    for (const id of ['bartender', 'cashier']) {
      const barter = data.dialogues[id].barter
      const stock = inventory.getSnapshot().containers[barter.id].items
      for (const staple of barter.items) assert.equal(stock.filter(item => item.itemId === staple.itemId).reduce((sum, item) => sum + item.quantity, 0), staple.quantity)
      assert.ok(stock.length <= barter.items.length + barter.stock.maxItems)
      const quantities = new Map()
      for (const stack of stock.filter(item => !barter.items.some(staple => staple.itemId === item.itemId))) quantities.set(stack.itemId, (quantities.get(stack.itemId) ?? 0) + stack.quantity)
      assert.ok(quantities.size >= barter.stock.minItems && quantities.size <= barter.stock.maxItems)
      for (const [itemId, quantity] of quantities) {
        const item = data.items.find(item => item.id === itemId)
        assert.ok(barter.stock.categories.includes(item.category))
        assert.notEqual(item.randomLoot, false, 'keys and courier parcels are not vendor-generated goods')
        assert.ok(quantity >= barter.stock.minQuantity && quantity <= barter.stock.maxQuantity)
      }
    }
  }
})

test('morning changes stock; visits, ordinary phases, and night do not reroll; sold goods survive', () => {
  const data = content()
  let roll = 0, calls = 0
  const random = () => { calls++; return roll }
  const inventory = new InventoryService(data.items, buildVendorSeeds(data.dialogues, data.items), random, [{ itemId: 'portrait', quantity: 1 }])
  const time = new DayTime()
  refreshContainersEachMorning(time, inventory)
  const initial = structuredClone(inventory.getSnapshot().containers)
  const initialCalls = calls
  for (let visit = 0; visit < 3; visit++) { inventory.openContainer('merchant:cashier'); inventory.closeMenu() }
  time.advance(); time.advance(); time.advance()
  assert.equal(calls, initialCalls)
  assert.deepEqual(inventory.getSnapshot().containers, initial)
  inventory.openContainer('merchant:cashier')
  inventory.storeItem('portrait', 0)
  inventory.closeMenu()
  const money = inventory.getSnapshot().money
  roll = 0.999
  time.advance()
  assert.notDeepEqual(inventory.getSnapshot().containers['merchant:cashier'].items, initial['merchant:cashier'].items)
  assert.notDeepEqual(inventory.getSnapshot().containers['merchant:bartender'].items, initial['merchant:bartender'].items)
  assert.equal(inventory.getSnapshot().containers['merchant:cashier'].items.find(item => item.itemId === 'portrait').quantity, 1)
  assert.equal(inventory.getSnapshot().money, money)
  time.nextMorning()
  assert.equal(inventory.getSnapshot().containers['merchant:cashier'].items.find(item => item.itemId === 'portrait').quantity, 1, 'sold goods never duplicate')
})

test('loading preserves daily vendor contents and purchases without replenishing stock', () => {
  const data = content()
  const seeds = buildVendorSeeds(data.dialogues, data.items)
  const inventory = new InventoryService(data.items, seeds, () => 0)
  inventory.grantItems([], 100)
  inventory.openContainer('merchant:bartender'); inventory.takeItem('spirits', 0); inventory.closeMenu()
  const saved = inventory.saveState()
  const loaded = new InventoryService(data.items, seeds, () => 0.999)
  loaded.restoreState(saved)
  assert.deepEqual(loaded.saveState(), saved)
  loaded.openContainer('merchant:bartender'); loaded.closeMenu()
  assert.deepEqual(loaded.saveState(), saved)
})

test('vendor stock config rejects unknown categories, empty pools, invalid counts and quantities', () => {
  for (const patch of [
    stock => { stock.categories = ['Unknown'] },
    stock => { stock.categories = ['Quest'] },
    stock => { stock.categories.push(stock.categories[0]) },
    stock => { stock.minItems = 4; stock.maxItems = 1 },
    stock => { stock.minItems = 10000; stock.maxItems = 10000 },
    stock => { stock.minQuantity = 4; stock.maxQuantity = 1 },
    stock => { stock.maxQuantity = 0 },
  ]) {
    const { data, sources } = catalogue()
    patch(data.dialogues.bartender.barter.stock)
    assert.throws(() => validateContent(data, sources), /dialogues\/bartender.json.barter.stock/)
  }
})


test('vendor stock and sales never create a second stack of an item, including morning replenishment', () => {
  const definitions = [{ id: 'tool', price: 2 }, { id: 'ammo', maxStack: 3, price: 2 }]
  const seed = { id: 'shop', name: 'Shop', locationId: 'test', vendor: true,
    items: [{ itemId: 'tool', quantity: 4 }],
    loot: { itemIds: ['ammo'], minItems: 1, maxItems: 1, minQuantity: 8, maxQuantity: 8 } }
  const inventory = new InventoryService(definitions, [seed], () => 0,
    [{ itemId: 'tool', quantity: 1 }, { itemId: 'ammo', quantity: 2 }])
  const stock = () => inventory.getSnapshot().containers.shop.items
  assert.deepEqual(stock(), [{ itemId: 'tool', quantity: 1 }, { itemId: 'ammo', quantity: 3 }])
  inventory.openContainer('shop')
  const before = inventory.getSnapshot()
  inventory.storeItem('tool', 0)
  inventory.storeItem('ammo', 1)
  assert.equal(inventory.getSnapshot(), before, 'full-stack sales neither remove items nor pay money')
  inventory.grantItems([], 10)
  inventory.takeItem('ammo', 1)
  inventory.storeItem('ammo', 1)
  inventory.refreshContainers()
  assert.deepEqual(stock(), [{ itemId: 'tool', quantity: 1 }, { itemId: 'ammo', quantity: 3 }])
})
