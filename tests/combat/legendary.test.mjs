import assert from 'node:assert/strict'
import test from 'node:test'
import { PatrolCombat } from '../../src/domain/combat/patrolCombat.ts'
const settings={health:100,meleeDamage:10,meleeRange:30,attackCooldownMs:1000,reactionDelayMs:0,deathHoldMs:1,chaseSpeed:1,levelTolerance:50,detectionRadius:100,hitFlashMs:1,chaseStopRatio:0.5}
test('interrupting a pending attack prevents delayed animation-completion damage',()=>{
 const combat=new PatrolCombat(settings);combat.engage();assert.equal(combat.update(0,true,true),10)
 combat.cancelAttack();assert.equal(combat.finishAttack(true,true),0)
 assert.equal(combat.update(1000,true,true),10);assert.equal(combat.finishAttack(true,true),10)
})
