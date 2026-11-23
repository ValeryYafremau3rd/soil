import assert from 'node:assert/strict'
import test from 'node:test'
import { legendarySkill, legendaryAttackMultiplier, interruptsAttack, itemBuffMultiplier, scaleItemBuff } from '../../src/domain/skills/effects.ts'
import { SKILL_LABELS, createCharacter } from '../../src/domain/skills/character.ts'
import { resolveEffectiveCharacter } from '../../src/domain/skills/condition.ts'
import { movementEnergyCost } from '../../src/domain/movement/energy.ts'
import { scrapChance, scrapReward } from '../../src/domain/inventory/scrap.ts'
import { emptyPerks, consumeForBuffs } from '../../src/domain/character/perks.ts'
import { content, catalogue } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'
const data=content(),defs=Object.fromEntries(data.items.map(item=>[item.id,item]))
const stack=itemId=>({itemId,quantity:1})
const hero=(intelligence=5,willpower=5)=>createCharacter({id:'test',name:'Test',attributes:{strength:3,agility:3,intelligence,willpower,charisma:3},startingItems:[]})
const full={energy:100,sanity:100}
const resolve=(character,items=[],state=emptyPerks())=>resolveEffectiveCharacter(character,items,defs,full,full,state,data.ui.consumableBuffs,data.ui.perks)
test('every legendary skill activates at 15 and disappears below the threshold',()=>{
 for(const skill of Object.keys(SKILL_LABELS))for(const value of [0,9,14,15,16,19,20,21,Infinity,NaN])assert.equal(legendarySkill({[skill]:value},skill),Number.isFinite(value)&&value>=15)
})

test('legendary Erudition scales eligible item buffs',()=>{
 assert.equal(itemBuffMultiplier({erudition:15}),1.5);assert.equal(itemBuffMultiplier({erudition:9}),1)
})
test('athletics exempts movement and jumps from Energy costs only while legendary',()=>{
 const costs={jump:5,perPixel:0.1}
 assert.equal(movementEnergyCost(100,true,costs,2,9),30)
 assert.equal(movementEnergyCost(100,true,costs,2,15),0)
 assert.equal(movementEnergyCost(100,true,costs,2,9),30)
})
test('ranged and opening-hit multipliers respect melee danger, combat state and skill loss',()=>{
 const skills={weapons:15,stealth:15}
 assert.equal(legendaryAttackMultiplier(skills,'shot',false,false),3)
 assert.equal(legendaryAttackMultiplier(skills,'shot',true,false),2)
 assert.equal(legendaryAttackMultiplier(skills,'shot',false,true),1.5)
 assert.equal(legendaryAttackMultiplier(skills,'melee',false,false),2)
 assert.equal(legendaryAttackMultiplier({weapons:9,stealth:9},'shot',false,false),1)
})
test('melee interruption is linear with charge, never at zero, guaranteed at full charge',()=>{
 assert.equal(interruptsAttack({martialArts:15},0,()=>0),false)
 assert.equal(interruptsAttack({martialArts:15},0.25,()=>0.24),true)
 assert.equal(interruptsAttack({martialArts:15},0.25,()=>0.25),false)
 assert.equal(interruptsAttack({martialArts:15},1,()=>1),true)
 assert.equal(interruptsAttack({martialArts:9},1,()=>0),false)
 assert.equal(interruptsAttack({martialArts:15},NaN,()=>0),false)
})
test('legendary Scraper keeps ordinary recovery chances and failed rolls return one bullet',()=>{
 assert.ok(Math.abs(scrapChance(15)-0.64)<1e-12)
 assert.ok(Math.abs(scrapChance(9)-0.40)<1e-12)
 assert.equal(scrapChance(1000),0.9)
 for(const roll of [0,0.639]){
  const rolls=[roll,0,0],reward=scrapReward(15,defs,()=>rolls.shift()??0)
  assert.ok(reward)
  assert.notEqual(defs[reward.itemId].ammunition,true)
 }
 for(const [roll,quantity] of [[0,1],[0.3334,1],[0.6667,1],[0.999,1]]){
  const rolls=[scrapChance(15),roll]
  assert.deepEqual(scrapReward(15,defs,()=>rolls.shift()),{itemId:'pistol-ammunition',quantity})
 }
 assert.equal(scrapReward(9,defs,()=>0.99),null)
})
test('medicine suppresses alcohol, food, medication and cigarette penalties including penalties to its own threshold',()=>{
 let state=emptyPerks()
 for(const id of ['spirits','red-cigarettes','medicine','white-tablets','red-tablets'])state=consumeForBuffs(state,data.ui.consumableBuffs,id,0,4)
 const strong=resolve(hero(),[],state)
 const clean=resolve(hero(),[],{...state,buffs:state.buffs.filter(active=>data.ui.consumableBuffs.find(buff=>buff.id===active.id).amount>0)})
 assert.deepEqual(strong.attributes,clean.attributes)
 const weak=resolve(hero(2,2),[],state)
 assert.ok(weak.attributes.intelligence<resolve(hero(2,2)).attributes.intelligence+1)
 assert.deepEqual(resolve(hero(),[],state).attributes,strong.attributes,'reactivation is repeatable and does not stack')
})
test('permanent reading bonuses keep their authored amount and respect equipped-only gear',()=>{
 const item=defs['sport-magazine-stealth'],gear=defs['work-jacket']
 const source={...stack(item.id),learned:true}
 const high=resolve(hero(),[source]),base=resolve(hero())
 assert.equal(high.skills.stealth-base.skills.stealth,item.bonus.amount)
 const low=resolve(hero(5,4),[source]),lowBase=resolve(hero(5,4))
 assert.equal(low.skills.stealth-lowBase.skills.stealth,item.bonus.amount)
 assert.equal(resolve(hero(),[stack(gear.id)]).skills.athletics-base.skills.athletics,
  [gear.bonus,...(gear.bonuses??[])].find(bonus=>bonus.skill==='athletics').amount)
})

test('Erudition rounds each positive item bonus down before combining bonuses and leaves penalties unchanged',()=>{
 for(const [amount,expected] of [[1,1],[3,4],[5,7],[15,22],[0,0],[-1,-1]]) assert.equal(scaleItemBuff(amount,1.5,'Book'),expected)
 for(const category of ['Weapon','Clothing','Medical','Food','Drink',undefined]) assert.equal(scaleItemBuff(3,1.5,category),3)
 assert.equal(scaleItemBuff(1,1),1)
 const definitions={a:{id:'a',category:'Book',bonus:{skill:'stealth',amount:3}},b:{id:'b',category:'Book',bonus:{skill:'stealth',amount:3}}}
 const boosted=resolveEffectiveCharacter(hero(),[stack('a'),stack('b')],definitions,full,full,emptyPerks(),[],[])
 assert.equal(boosted.skills.stealth-resolve(hero()).skills.stealth,8)
 const ordinary=resolveEffectiveCharacter(hero(2,2),[stack('a'),stack('b')],definitions,full,full,emptyPerks(),[],[])
 assert.equal(ordinary.skills.stealth-resolve(hero(2,2)).skills.stealth,6)
})
test('legendary configuration validates scrap chance, ammunition, skills and vendor reference',()=>{
 for(const patch of [x=>{x.scrapping.bonusChance=1.1},x=>{x.scrapping.fallbackReward.minQuantity=4},x=>{x.scrapping.fallbackReward.itemId='bandage'},x=>{x.scrapping.fallbackReward.itemId='missing'},x=>{x.perks.pop()},x=>{x.perks.push(x.perks[0])},x=>{x.barter.vendorId='missing'}]){
  const {data,sources}=catalogue();patch(data.skills.legendary);assert.throws(()=>validateContent(data,sources),/legendary/)
 }
})
