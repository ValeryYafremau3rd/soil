import assert from 'node:assert/strict'
import test from 'node:test'
import { LockpickingService } from '../../src/app/services/LockpickingService.ts'
import { DayTime } from '../../src/app/services/DayTime.ts'
import { content } from '../helpers/content.mjs'
test('legendary lockpicking needs no pick, never breaks one, and skill loss is checked before completion',()=>{
 let skill=15,broken=0,unlocked=0
 const locks=new LockpickingService(new DayTime(1,'night'),()=>skill,content().skills,{has:()=>false,canUse:()=>false,consume:()=>{broken++;return false}},()=>0,()=>0)
 const open=()=>locks.attemptContainer('box','Box',()=>unlocked++)
 open();assert.ok(locks.getSnapshot().puzzle);locks.close();assert.equal(broken,0)
 open();skill=14;for(const [index,value] of [1,1,2].entries())locks.setNumber(index,value)
 locks.submit();assert.equal(unlocked,0);assert.equal(broken,1)
 open();assert.equal(locks.getSnapshot().puzzle,null)
 skill=15;open();for(const [index,value] of [1,1,2].entries())locks.setNumber(index,value)
 locks.submit();assert.equal(unlocked,1);assert.equal(broken,1);locks.submit();assert.equal(unlocked,1)
})
