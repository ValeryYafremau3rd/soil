import assert from 'node:assert/strict'
import test from 'node:test'
import { createCharacter, calculateSkills } from '../../src/domain/skills/character.ts'
import { conditionedCharacter } from '../../src/domain/skills/condition.ts'
import { StatusService } from '../../src/app/services/StatusService.ts'
import { resolveSkillEffects } from '../../src/domain/skills/effects.ts'
import { content } from '../helpers/content.mjs'

const base=createCharacter({id:'test',name:'Test',attributes:{strength:6,agility:4,intelligence:5,willpower:3,charisma:2},startingItems:[],startingMoney:0})
const limits={energy:100,sanity:100}
const applyVitalPenalties=(character,vitals,limits)=>conditionedCharacter(character,[],{},vitals,limits)

test('40 of 120 Sanity reduces one-point attributes to zero and larger attributes proportionally', () => {
  const caps = { energy: 120, sanity: 120 }
  const vitals = { energy: 120, sanity: 40 }
  const low = createCharacter({ id: 'low', name: 'Low', attributes: { ...base.baseAttributes, intelligence: 1, charisma: 1 }, startingItems: [] })
  assert.deepEqual(applyVitalPenalties(low, vitals, caps).attributes, { ...low.attributes, intelligence: 0, charisma: 0 })
  const high = createCharacter({ id: 'high', name: 'High', attributes: { ...base.baseAttributes, intelligence: 12, charisma: 12 }, startingItems: [] })
  const current = applyVitalPenalties(high, vitals, caps)
  assert.equal(current.attributes.intelligence, 10)
  assert.equal(current.attributes.charisma, 10)
})

test('Energy scales physical attributes and Sanity scales mental and social attributes',()=>{
  const half=applyVitalPenalties(base,{energy:25,sanity:40},limits)
  assert.deepEqual(half.attributes,{strength:3,agility:2,intelligence:4,willpower:3,charisma:1})
  assert.deepEqual(half.skills,calculateSkills(half.attributes))
  const exhausted=applyVitalPenalties(base,{energy:0,sanity:0},limits)
  assert.deepEqual(exhausted.attributes,{strength:0,agility:0,intelligence:2,willpower:3,charisma:1})
  assert.ok(Object.values(exhausted.skills).every(value=>value>=1))
  assert.deepEqual(applyVitalPenalties(base,{energy:100,sanity:100},limits),base)
  assert.deepEqual(applyVitalPenalties(base,{energy:200,sanity:200},limits),base)
})

test('Energy and Sanity penalties begin strictly below fifty percent of their own maximum',()=>{
  const customLimits={energy:150,sanity:125}
  for(const vitals of [{energy:150,sanity:125},{energy:135,sanity:110},{energy:75.01,sanity:100},{energy:75,sanity:62.5}]) {
    assert.deepEqual(applyVitalPenalties(base,vitals,customLimits),base)
  }
  const tired=applyVitalPenalties(base,{energy:74.99,sanity:100},customLimits)
  assert.equal(tired.attributes.intelligence,base.attributes.intelligence)
  assert.ok(tired.attributes.strength<base.attributes.strength)
  assert.ok(tired.skills.scraper<base.skills.scraper)
  const shaken=applyVitalPenalties(base,{energy:120,sanity:62},customLimits)
  assert.equal(shaken.attributes.strength,base.attributes.strength)
  assert.ok(shaken.attributes.intelligence<base.attributes.intelligence)
  assert.deepEqual(shaken.skills,calculateSkills(shaken.attributes))
})

test('conditions do not mutate the base character and recovery restores values without accumulating penalties',()=>{
  const original=structuredClone(base)
  const exhausted=conditionedCharacter(base,[],{}, {energy:10,sanity:10},limits)
  assert.equal(exhausted.attributes.strength,1)
  assert.deepEqual(conditionedCharacter(exhausted,[],{}, {energy:100,sanity:100},limits),base)
  assert.deepEqual(base,original)
  assert.deepEqual(applyVitalPenalties(base,{energy:50,sanity:100},limits).attributes,base.attributes)
  const shaken=applyVitalPenalties(base,{energy:100,sanity:50},limits)
  assert.deepEqual(shaken.skills,calculateSkills(shaken.attributes))
})

test('Sanity penalties are gentler, scale with maximum Sanity, and clear on recovery',()=>{
  const hero=createCharacter({id:'steady',name:'Steady',attributes:{strength:20,agility:20,intelligence:20,willpower:20,charisma:20},startingItems:[],startingMoney:0})
  for(const maximum of [100,150]) {
    const caps={energy:100,sanity:maximum}
    for(const [fraction,expected] of [[1,20],[0.5,20],[0.49,19],[0.25,15],[0.1,12],[0,10]]) {
      const current=applyVitalPenalties(hero,{energy:100,sanity:maximum*fraction},caps)
      assert.equal(current.attributes.intelligence,expected,`${maximum}: ${fraction}`)
      assert.equal(current.attributes.charisma,expected)
      assert.equal(current.attributes.strength,20)
      assert.equal(current.attributes.agility,20)
      assert.equal(current.attributes.willpower,20)
      const skills=calculateSkills(current.attributes)
      skills.erudition=Math.min(20,skills.erudition)
      assert.deepEqual(current.skills,skills)
      assert.deepEqual(applyVitalPenalties(current,{energy:100,sanity:maximum},caps),
        applyVitalPenalties(hero,{energy:100,sanity:maximum},caps))
    }
  }
})

test('Sanity lowers derived skills without disabling eligible carried bonuses',()=>{
  const definitions={manual:{id:'manual',eruditionRequired:10,bonus:{skill:'scraper',amount:8}}}
  const stacks=[{itemId:'manual',quantity:1}]
  const full=conditionedCharacter(base,stacks,definitions,{energy:100,sanity:100},limits)
  assert.equal(full.skills.scraper,base.skills.scraper+8)
  const tired=conditionedCharacter(base,stacks,definitions,{energy:100,sanity:0},limits)
  assert.equal(tired.skills.erudition,7)
  assert.equal(tired.skills.scraper,18)
})

test('conditions cannot remove carried bonuses from unrelated attributes', () => {
  const definitions = {
    physical: { id: 'physical', eruditionRequired: 10, bonuses: [{ attribute: 'strength', amount: 8 }, { attribute: 'agility', amount: 3 }] },
    mental: { id: 'mental', skillRequirements: { athletics: 12 }, bonuses: [{ attribute: 'intelligence', amount: 4 }, { attribute: 'charisma', amount: 3 }, { attribute: 'willpower', amount: 2 }] },
  }
  const items = [{ itemId: 'physical', quantity: 1 }, { itemId: 'mental', quantity: 1 }]
  const full = conditionedCharacter(base, items, definitions, { energy: 120, sanity: 120 }, { energy: 120, sanity: 120 })
  for (const sanity of [40, 1, 0]) {
    const current = conditionedCharacter(base, items, definitions, { energy: 119, sanity }, { energy: 120, sanity: 120 })
    for (const key of ['strength', 'agility', 'willpower']) assert.equal(current.attributes[key], full.attributes[key])
    assert.ok(current.attributes.intelligence < full.attributes.intelligence)
    assert.ok(current.attributes.charisma < full.attributes.charisma)
  }
  for (const energy of [40, 1, 0]) {
    const current = conditionedCharacter(base, items, definitions, { energy, sanity: 120 }, { energy: 120, sanity: 120 })
    for (const key of ['intelligence', 'charisma', 'willpower']) assert.equal(current.attributes[key], full.attributes[key])
    assert.ok(current.attributes.strength < full.attributes.strength)
    assert.ok(current.attributes.agility < full.attributes.agility)
  }
})

test('Energy penalties drive actual skill-effect multipliers',()=>{
  const rates=content().skills
  const full=resolveSkillEffects(base.skills,rates)
  const tired=resolveSkillEffects(applyVitalPenalties(base,{energy:25,sanity:100},limits).skills,rates)
  assert.ok(tired.movement<full.movement)
  assert.ok(tired.meleeDamage<full.meleeDamage)
  assert.equal(tired.recovery,full.recovery)
})

test('zero Energy is survivable; zero Sanity kills immediately and ordinary recovery cannot revive',()=>{
  const status=new StatusService()
  const initial=status.getSnapshot()
  status.drain({energy:1000})
  assert.equal(status.getSnapshot().health,initial.health)
  status.drain({sanity:initial.sanity-1})
  assert.equal(status.getSnapshot().health,initial.health)
  status.drain({sanity:1})
  assert.deepEqual(status.getSnapshot(),{health:0,energy:0,sanity:0})
  assert.equal(status.recover({health:1000,sanity:1000,energy:1000}),false)
  status.setLimits(content().ui.stats.map(stat=>({...stat,max:500})))
  assert.equal(status.getSnapshot().health,0)
  status.restoreState({health:80,energy:40,sanity:0})
  assert.equal(status.getSnapshot().health,0,'saved zero Sanity is also fatal')
})
