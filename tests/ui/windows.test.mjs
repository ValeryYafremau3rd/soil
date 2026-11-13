import assert from 'node:assert/strict'
import test from 'node:test'
import { coordinateWindows } from '../../src/app/services/coordinateWindows.ts'
import { HudService } from '../../src/app/services/HudService.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { TravelService } from '../../src/app/services/TravelService.ts'
import { DialogueService } from '../../src/app/services/DialogueService.ts'
import { RestService } from '../../src/app/services/RestService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { LockpickingService } from '../../src/app/services/LockpickingService.ts'
import { QuestService } from '../../src/app/services/QuestService.ts'

function setup() {
  const time = new DayTime()
  const services = {
    hud: new HudService(['character', 'map', 'quests']),
    inventory: new InventoryService([{ id: 'bandage', consumable: true, maxStack: 5 }], [{
      id: 'crate', name: 'Crate', locationId: 'test', items: [{ itemId: 'bandage', quantity: 2 }],
    }]),
    travel: new TravelService([{ id: 'test', name: 'Test' }], time),
    dialogue: new DialogueService(), rest: new RestService(time),
    lockpicking: new LockpickingService(new DayTime(1, 'night'), () => 0, { lockpickingBaseSeconds: 10, lockpickingSecondsPerPoint: 1 }, { has: () => true, consume: () => true }),
  }
  services.quests = new QuestService([], services.inventory)
  const dispose = coordinateWindows(services)
  const open = [
    () => services.hud.openMenu('character'),
    () => services.hud.openMenu('map'),
    () => services.hud.openMenu('quests'),
    () => services.inventory.openInventory(),
    () => services.inventory.openContainer('crate'),
    () => services.travel.openTravel(),
    () => services.dialogue.openDialogue('NPC', { start: 'hello', nodes: {
      hello: { text: 'Hello', choices: [] },
    } }),
    () => services.rest.open('rest', 'Bench'),
    () => services.lockpicking.attempt('door', 'Door'),
    () => services.quests.openBoard(),
  ]
  const active = () => [
    services.hud.getSnapshot().menuId,
    services.inventory.getSnapshot().menu,
    services.travel.getSnapshot().menuOpen,
    services.dialogue.getSnapshot().conversation,
    services.rest.getSnapshot().menu,
    services.lockpicking.getSnapshot().puzzle,
    services.quests.getSnapshot().boardOpen,
  ].filter(Boolean).length
  return { services, time, open, active, dispose }
}

test('every pair of windows switches to the newly opened window without stacking', () => {
  for (let first = 0; first < 10; first++) {
    for (let next = 0; next < 10; next++) {
      const { open, active, time, services } = setup()
      const beforeTime = time.getSnapshot()
      open[first]()
      open[next]()
      assert.equal(active(), 1, `switch ${first} to ${next}`)
      assert.equal(time.getSnapshot(), beforeTime, 'switching does not confirm travel or rest')
      assert.equal(services.inventory.getSnapshot().containers.crate.items[0].quantity, 2)
    }
  }
})

test('invalid open requests preserve the current window and coordinator can unsubscribe', () => {
  const { services, active, dispose } = setup()
  services.hud.openMenu('character')
  services.inventory.openContainer('missing')
  services.dialogue.openDialogue('NPC', { start: 'missing', nodes: {} })
  assert.equal(services.hud.getSnapshot().menuId, 'character')
  assert.equal(active(), 1)
  services.inventory.openContainer('crate')
  assert.equal(services.hud.getSnapshot().menuId, null)
  services.inventory.takeAll()
  assert.equal(active(), 1, 'inventory updates keep its window open')
  services.inventory.closeMenu()
  assert.equal(active(), 0)
  dispose()
  services.hud.openMenu('character')
  services.travel.openTravel()
  assert.equal(active(), 2)
})

