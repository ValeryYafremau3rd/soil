import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveDamageResistance } from '../../src/domain/inventory/items.ts'
import { buffDamageResistance, consumeForBuffs, emptyPerks, expirePerks } from '../../src/domain/character/perks.ts'
import { InventoryService } from '../../src/app/services/InventoryService.ts'
import { PerksService } from '../../src/app/services/PerksService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { RestService } from '../../src/app/services/RestService.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue } from '../helpers/content.mjs'

test('carried clothing resistance ignores requirements and respects removal, duplicates and total cap', () => {
 const defs = { coat: { id: 'coat', damageResistance: 20, eruditionRequired: 2 } }
 const stack = { itemId: 'coat', quantity: 1 }
 assert.equal(resolveDamageResistance([stack, stack], defs, { erudition: 2 }, 10), 30)
 assert.equal(resolveDamageResistance([stack], defs, {}, 10), 30)
 assert.equal(resolveDamageResistance([], defs, {}, 10), 10)
 assert.equal(resolveDamageResistance([{ ...stack, quantity: 0 }], defs, { erudition: 2 }), 0)
 assert.equal(resolveDamageResistance([stack], defs, { erudition: 2 }, 95), 100)
})
test('consumable resistance refreshes without stacking and expires after four phases', () => {
 const { data } = catalogue(), defs = data.ui.consumableBuffs
 let state = consumeForBuffs(emptyPerks(), defs, 'steroids', 0, 4)
 assert.equal(buffDamageResistance(state, defs), 20)
 state = consumeForBuffs(state, defs, 'steroids', 2, 4)
 assert.equal(buffDamageResistance(state, defs), 20)
 state = expirePerks(state, [], 4, 4)
 assert.equal(buffDamageResistance(state, defs), 20)
 state = expirePerks(state, [], 6, 4)
 assert.equal(buffDamageResistance(state, defs), 0)
})
test('resistance reduces health damage dynamically, leaving sanity costs intact', () => {
 let resistance = 20
 const status = new StatusService(undefined, undefined, () => resistance)
 const initial = status.getSnapshot()
 status.takeDamage(10)
 assert.equal(status.getSnapshot().health, initial.health - 8)
 resistance = 0
 status.takeDamage(10)
 assert.equal(status.getSnapshot().health, initial.health - 18)
 status.drain({ sanity: 5 })
 assert.equal(status.getSnapshot().sanity, initial.sanity - 5)
 status.takeDamage(Infinity)
 assert.equal(status.getSnapshot().health, initial.health - 18)
})
test('content caps clothing resistance at 20 and consumable resistance at 30', () => {
 for (const value of [0, -1, 21, 1.5]) {
 const { data, sources } = catalogue()
 data.items.find(i => i.id === 'military-coat').damageResistance = value
 assert.throws(() => validateContent(data, sources), /damageResistance/)
 }
 const { data, sources } = catalogue()
 data.ui.consumableBuffs.find(b => b.damageResistance).amount = 31
 assert.throws(() => validateContent(data, sources), /damage resistance/)
})
test('painkillers reduce incoming damage by 30 percent, refresh, expire and clear on sleep',()=>{
 const {data}=catalogue();const buffs=data.ui.consumableBuffs
 const time=new DayTime()
 const status=new StatusService(undefined,undefined,()=>buffDamageResistance(perks.getSnapshot(),buffs))
 const perks=new PerksService(data.ui.perks,time,status,undefined,undefined,buffs)
 status.setItemEffects(perks)
 const inventory=new InventoryService(data.items,[],()=>0,[{itemId:'red-tablets',quantity:4}],status,undefined,undefined,undefined,()=>20,false,undefined,undefined,()=>({medicine:10}))
 assert.equal(data.items.find(item=>item.id==='red-tablets').name,'Painkillers')
 const original=status.getSnapshot()
 inventory.useItem(0)
 assert.equal(inventory.getSnapshot().items[0].quantity,3)
 assert.equal(buffDamageResistance(perks.getSnapshot(),buffs),30)
 assert.deepEqual(status.getSnapshot(),original,'effect-only medicine works at full vitals without healing')
 status.takeDamage(10);assert.equal(status.getSnapshot().health,original.health-7)
 time.advance();time.advance();inventory.useItem(0)
 assert.equal(buffDamageResistance(perks.getSnapshot(),buffs),30)
 time.advance();time.advance();time.advance()
 assert.equal(buffDamageResistance(perks.getSnapshot(),buffs),30)
 time.advance();assert.equal(buffDamageResistance(perks.getSnapshot(),buffs),0)
 status.takeDamage(10);assert.equal(status.getSnapshot().health,original.health-17)
 inventory.useItem(0)
 const rest=new RestService(time,status,{rest:0,sleep:0},perks.clearTimedEffects)
 rest.open('sleep','Bed');rest.close()
 assert.equal(buffDamageResistance(perks.getSnapshot(),buffs),30)
 rest.open('sleep','Bed');rest.confirm(1)
 assert.equal(buffDamageResistance(perks.getSnapshot(),buffs),0)
})
test('painkillers retain medicine requirements and rejected uses spend nothing',()=>{
 const {data}=catalogue();const inventory=new InventoryService(data.items,[],()=>0,[{itemId:'red-tablets',quantity:2}])
 inventory.openInventory();const before=inventory.getSnapshot()
 inventory.useItem(0);inventory.useItem(0)
 assert.equal(inventory.getSnapshot(),before)
})
