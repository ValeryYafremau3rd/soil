import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveFearResistance } from '../../src/domain/inventory/items.ts'
import { fearDamage, MonsterFear, monsterAttackSanityDamage } from '../../src/domain/combat/patrolCombat.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { StatusService } from '../../src/app/services/character/StatusService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { catalogue } from '../helpers/content.mjs'

const stack = itemId => ({ itemId, quantity: 1 })
const skills = { erudition: 20, barter: 10, persuasion: 10 }

test('symbolic items add percentage resistance once per type and stop on removal', () => {
  const { data } = catalogue()
  const definitions = Object.fromEntries(data.items.map(item => [item.id, item]))
  const ids = ['photographs', 'horseshoe-charm', 'medal', 'triquetra-pendant']
  assert.deepEqual(ids.map(id => definitions[id].fearResistance), [5, 10, 15, 20])
  assert.equal(resolveFearResistance([...ids, 'medal'].map(stack), definitions, skills), 50)
  assert.equal(resolveFearResistance([stack('medal')], definitions, skills), 15)
  assert.equal(resolveFearResistance([], definitions, skills), 0)
  assert.equal(resolveFearResistance([{ itemId: 'medal', quantity: 0 }], definitions, skills), 0)
  assert.equal(resolveFearResistance([stack('medal')], { medal: { ...definitions.medal, eruditionRequired: 20 } }, {}), 15)
  const many = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), { id: String(i), fearResistance: 20 }]))
  assert.equal(resolveFearResistance(Object.keys(many).map(stack), many, {}), 100)
})

test('resistance reduces aura, notice and monster attack sanity damage without reducing health hits or time costs', () => {
  const fear = new MonsterFear({ radius: 100, sanityPerSecond: 4, noticeSanityDamage: 6 })
  const source = { x: 0, y: 0 }, target = { ...source, available: true }
  assert.equal(fearDamage(fear.update(1000, source, target, true, true), 20), 8)
  assert.equal(fearDamage(fear.update(1000, source, target, true, true), 20), 3.2)
  assert.equal(fear.update(1000, source, { ...target, available: false }, true, true), 0)
  assert.equal(fear.update(1000, source, target, true, false), 0)
  const status = new StatusService(['health', 'energy', 'sanity'].map(id => ({ id, value: 100, max: 100 })))
  status.takeDamage(20)
  status.drain({ sanity: fearDamage(monsterAttackSanityDamage(20), 20) })
  assert.equal(status.getSnapshot().health, 80)
  assert.equal(status.getSnapshot().sanity, 92)
  status.drain({ sanity: 5 })
  assert.equal(status.getSnapshot().sanity, 87)
  assert.equal(fearDamage(10, 100), 0)
  assert.equal(fearDamage(10, 200), 0)
  assert.equal(fearDamage(10, -20), 10)
  assert.equal(fearDamage(Infinity, 20), 0)
})

test('content rejects fear resistance outside the authored 5–20 percent range', () => {
  for (const value of [0, 4, 21, -5, 5.5]) {
    const { data, sources } = catalogue()
    data.items.find(item => item.id === 'medal').fearResistance = value
    assert.throws(() => validateContent(data, sources), /fearResistance/)
  }
})
test('every amulet gives 5 to 20 percent fear resistance only while equipped',()=>{
  const {data}=catalogue()
  const definitions=Object.fromEntries(data.items.map(item=>[item.id,item]))
  const amulets=data.items.filter(item=>item.equipmentSlot==='amulet')
  assert.equal(amulets.length,5)
  assert.ok(amulets.every(item=>Number.isInteger(item.fearResistance)&&item.fearResistance>=5&&item.fearResistance<=20))
  for(const amulet of amulets){
    const inventory=new InventoryService(data.items,[],()=>0,[stack(amulet.id)],undefined,undefined,undefined,undefined,()=>20,false,undefined,undefined,()=>skills)
    const resistance=()=>resolveFearResistance(inventory.getBonusItems(),definitions,skills)
    assert.equal(resistance(),0)
    inventory.openInventory();inventory.useItem(0)
    assert.equal(resistance(),amulet.fearResistance)
    inventory.unequip('amulet');inventory.unequip('amulet')
    assert.equal(resistance(),0)
  }
})
test('amulet definitions require fear resistance within 5 to 20 percent',()=>{
  for(const value of [undefined,0,4,21,5.5]){
    const {data,sources}=catalogue()
    const amulet=data.items.find(item=>item.id==='red-star')
    if(value===undefined)delete amulet.fearResistance
    else amulet.fearResistance=value
    assert.throws(()=>validateContent(data,sources),/fearResistance/)
  }
})
