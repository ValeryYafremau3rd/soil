import assert from 'node:assert/strict'
import test from 'node:test'
import { createCharacter, calculateSkills } from '../../src/domain/skills/character.ts'
import { conditionedCharacter } from '../../src/domain/skills/condition.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { resolveSkillEffects } from '../../src/domain/skills/effects.ts'
import { content } from '../helpers/content.mjs'

const base=createCharacter({id:'test',name:'Test',attributes:{strength:6,agility:4,intelligence:5,willpower:3,charisma:2},startingItems:[],startingMoney:0})
const limits={energy:100,sanity:100}
const applyVitalPenalties=(character,vitals,limits)=>conditionedCharacter(character,[],{},vitals,limits)

test('Sanity scales all skills while Energy scales all attributes', () => {
  for (const maximum of [100, 150]) {
    const caps = { energy: maximum, sanity: maximum }
    const full = applyVitalPenalties(base, caps, caps)
    for (const [fraction, multiplier] of [[1, 1], [0.5, 1], [0.49, 0.98], [0.34, 0.68], [0.25, 0.5], [0, 0]]) {
      const shaken = applyVitalPenalties(base, { energy: maximum, sanity: maximum * fraction }, caps)
      assert.deepEqual(shaken.attributes, base.attributes)
      for (const [skill, value] of Object.entries(full.skills)) assert.equal(shaken.skills[skill], Math.max(1, Math.floor(value * multiplier)))
      const tired = applyVitalPenalties(base, { energy: maximum * fraction, sanity: maximum }, caps)
      for (const [attribute, value] of Object.entries(base.attributes)) assert.equal(tired.attributes[attribute], Math.floor(value * multiplier))
      const derived = calculateSkills(tired.attributes)
      for (const skill of Object.keys(derived)) derived[skill] = Math.max(1, Math.min(skill === 'erudition' ? 20 : Infinity, derived[skill]))
      assert.deepEqual(tired.skills, derived)
    }
  }
})

test('combined penalties include carried bonuses and recovery restores the base', () => {
  const original = structuredClone(base)
  const definitions = { badge: { id: 'badge', bonuses: [{ attribute: 'willpower', amount: 7 }, { skill: 'scraper', amount: 8 }] } }
  const items = [{ itemId: 'badge', quantity: 1 }]
  const full = conditionedCharacter(base, items, definitions, limits, limits)
  const tired = conditionedCharacter(base, items, definitions, { energy: 25, sanity: 100 }, limits)
  assert.equal(tired.attributes.willpower, 5)
  const both = conditionedCharacter(base, items, definitions, { energy: 25, sanity: 34 }, limits)
  assert.deepEqual(both.attributes, tired.attributes)
  for (const [skill, value] of Object.entries(tired.skills)) assert.equal(both.skills[skill], Math.max(1, Math.floor(value * 0.68)))
  assert.deepEqual(conditionedCharacter(both, items, definitions, limits, limits), full)
  assert.deepEqual(base, original)
  const effects = content().skills
  assert.ok(resolveSkillEffects(both.skills, effects).movement < resolveSkillEffects(full.skills, effects).movement)
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
