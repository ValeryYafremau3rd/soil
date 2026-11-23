import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { PerksService } from '../../src/app/services/character/PerksService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { buffFearResistance, normalizeConsumableGroups, emptyPerks } from '../../src/domain/character/perks.ts'

const {ui}=content()
test('legacy stacked effects keep the newest category bundle without dropping other categories',()=>{
 const buffs=ui.consumableBuffs.filter(buff=>buff.itemIds.includes('white-tablets')||buff.itemIds.includes('red-tablets')||buff.itemIds.includes('bread'))
 const state={...emptyPerks(),buffs:buffs.map(buff=>({id:buff.id,expiresAt:buff.itemIds.includes('red-tablets')?8:7}))}
 const normalized=normalizeConsumableGroups(state,ui.consumableBuffs)
 assert.deepEqual(normalized.buffs.map(active=>active.id).sort(),ui.consumableBuffs.filter(buff=>buff.itemIds.includes('red-tablets')||buff.itemIds.includes('bread')).map(buff=>buff.id).sort())
 assert.deepEqual(normalizeConsumableGroups(normalized,ui.consumableBuffs),normalized)
})
test('food, alcohol and medicine each replace their own effect bundle and preserve other categories',()=>{
 const time=new DayTimeService(),perks=new PerksService(ui.perks,time,{drain(){}},undefined,undefined,ui.consumableBuffs)
 const active=group=>perks.getSnapshot().buffs.filter(active=>ui.consumableBuffs.find(buff=>buff.id===active.id)?.group===group).map(buff=>buff.id).sort()
 const expected=item=>ui.consumableBuffs.filter(buff=>buff.itemIds.includes(item)).map(buff=>buff.id).sort()
 perks.consumed('bread',{});perks.consumed('spirits',{});perks.consumed('steroids',{})
 assert.deepEqual(active('food'),expected('bread'))
 assert.deepEqual(active('alcohol'),expected('spirits'))
 assert.deepEqual(active('medicine'),expected('steroids'))
 perks.consumed('tinned-beef',{});assert.deepEqual(active('food'),expected('tinned-beef'))
 perks.consumed('beer-bottle',{});assert.deepEqual(active('alcohol'),expected('beer-bottle'))
 assert.equal(buffFearResistance(perks.getSnapshot(),ui.consumableBuffs),5)
 perks.consumed('white-tablets',{});assert.deepEqual(active('medicine'),expected('white-tablets'))
 assert.deepEqual(active('food'),expected('tinned-beef'))
 assert.deepEqual(active('alcohol'),expected('beer-bottle'))
 time.advance();perks.consumed('white-tablets',{})
 assert.deepEqual(active('medicine'),expected('white-tablets'))
 const restored=new PerksService(ui.perks,time,{drain(){}},structuredClone(perks.getSnapshot()),undefined,ui.consumableBuffs)
 assert.deepEqual(restored.getSnapshot().buffs,perks.getSnapshot().buffs)
 perks.clearTimedEffects();assert.deepEqual(perks.getSnapshot().buffs,[])
})
