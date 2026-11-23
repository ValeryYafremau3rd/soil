import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { MonsterFear, monsterAttackSanityDamage, detectsHero, PatrolCombat } from '../../src/domain/combat/patrolCombat.ts'
import { resolveIndoorPatrolPopulations, resolvePatrolPopulation, resolvePatrolEncounter } from '../../src/app/content/resolvePatrolPopulation.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { patrolDifficulty, resolveDifficulty } from '../../src/domain/character/difficulty.ts'
import { catalogue, content } from '../helpers/content.mjs'

const data = content()
const octopus = data.patrols.types.octopus
const source = { x: 0, y: 0 }

test('fear aura eligibility is immediate and respects range, hidden heroes, and living sources', () => {
  const fear = new MonsterFear(octopus.combat.fear)
  const target = { x: octopus.combat.fear.radius, y: 0, available: true }
  assert.equal(fear.affects(source, target, true), true)
  assert.equal(fear.update(0, source, target, false, true), 0)
  assert.equal(fear.affects(source, { ...target, x: target.x + 1 }, true), false)
  assert.equal(fear.affects(source, { ...target, available: false }, true), false)
  assert.equal(fear.affects(source, target, false), false)
})

test('monster fear reaches beyond detection, accrues consistently, and notice damage fires once per detection', () => {
  const fear = new MonsterFear(octopus.combat.fear)
  const target = { x: 600, y: 0, available: true }
  assert.equal(detectsHero(source, target, octopus.combat.detectionRadius, true), false)
  assert.equal(fear.update(1000, source, target, false, true), 4)
  target.x = 200
  assert.equal(fear.update(0, source, target, true, true), 6)
  assert.equal(fear.update(1000, source, target, true, true), 4)
  assert.equal(fear.update(0, source, target, false, true), 0)
  assert.equal(fear.update(0, source, target, true, true), 6)
  const smallSteps = new MonsterFear(octopus.combat.fear)
  assert.equal(Array.from({ length: 20 }, () => smallSteps.update(50, source, target, false, true)).reduce((a,b)=>a+b,0), 4)
})

test('fear respects range boundaries, unavailable heroes, dead/inactive monsters, and paused time', () => {
  const fear = new MonsterFear(octopus.combat.fear)
  const target = { x: 840, y: 0, available: true }
  assert.equal(fear.update(1000, source, target, false, true), 4)
  assert.equal(fear.update(1000, source, { ...target, x: 841 }, false, true), 0)
  assert.equal(fear.update(1000, source, { ...target, available: false }, true, true), 0)
  assert.equal(fear.update(1000, source, target, true, false), 0)
  assert.equal(fear.update(0, source, target, false, true), 0)
})

test('monster hits cost half their actual health damage in sanity only after attack completion', () => {
  const combat = new PatrolCombat(octopus.combat)
  combat.engage()
  combat.update(octopus.combat.reactionDelayMs, true, true)
  assert.equal(combat.health, 320)
  assert.equal(monsterAttackSanityDamage(combat.finishAttack(true, true)), 18)
  assert.equal(monsterAttackSanityDamage(combat.finishAttack(true, true)), 0)
  assert.equal(monsterAttackSanityDamage(35), 17.5)
  assert.equal(monsterAttackSanityDamage(-1), 0)
  assert.equal(monsterAttackSanityDamage(Infinity), 0)
})

test('octopuses spawn only at night inside the factory and barracks without changing officer populations', () => {
  const config = data.patrols
  for (const location of ['factory','living-district']) {
    for (const phase of ['morning','afternoon','evening']) assert.deepEqual(resolveIndoorPatrolPopulations(config,location,phase),[])
    const populations = resolveIndoorPatrolPopulations(config,location,'night')
    assert.equal(populations.length,1)
    assert.equal(populations[0].count,1)
    assert.equal(populations[0].definition.kind,'monster')
    assert.equal(populations[0].location.floor,0)
    assert.equal(populations[0].location.buildingId,location==='factory'?'factory-main':'living-barracks')
  }
  assert.deepEqual(resolveIndoorPatrolPopulations(config,'center','night'),[])
  assert.equal(resolvePatrolPopulation(config,'factory','night'), undefined)
  const disabled=structuredClone(config)
  disabled.locations.factory.interiors[0].enabled=false
  assert.deepEqual(resolveIndoorPatrolPopulations(disabled,'factory','night'),[])
})

test('both monster sheets have fitting crops for all four authored animation rows', () => {
  for (const definition of [octopus,data.patrols.types.titan]) {
  const png=readFileSync(new URL(`../../public/${definition.path}`,import.meta.url))
  const ratio=png.readUInt32BE(16)/definition.referenceWidth
  for(const [frames,count] of [[definition.idleSteps,6],[definition.walk.steps,8],[definition.attack.steps,8],[definition.death.steps,8]]) {
    assert.equal(frames.length,count)
    for(const crop of frames) {
      assert.ok((crop.x+crop.width)*ratio<=png.readUInt32BE(16))
      assert.ok((crop.y+crop.height)*ratio<=png.readUInt32BE(20))
    }
  }
  }
  assert.ok(octopus.combat.health>data.patrols.types.patrol.combat.health)
  assert.ok(octopus.combat.meleeDamage>data.patrols.types.patrol.combat.meleeDamage)
  assert.ok(octopus.combat.fear.radius>octopus.combat.detectionRadius)
})

test('monster fear follows monster difficulty scaling for radius and damage', () => {
  for(const preset of data.difficulty.presets) {
    const rules=resolveDifficulty(data.difficulty,preset.id,{ hero:data.hero.settings, stats:data.ui.stats, rest:data.ui.rest, timeCosts:data.daytime.statCostsPerPhase })
    const adjusted=patrolDifficulty(octopus.combat,rules,'monster')
    assert.equal(adjusted.fear.radius,octopus.combat.fear.radius*preset.modifiers.monsterStrength)
    assert.equal(adjusted.fear.sanityPerSecond,octopus.combat.fear.sanityPerSecond*preset.modifiers.monsterStrength)
    assert.equal(monsterAttackSanityDamage(adjusted.meleeDamage),adjusted.meleeDamage/2)
  }
})

test('legacy weighted encounters remain supported', () => {
  const config = structuredClone(data.patrols)
  for (const [id, location] of Object.entries(config.locations)) {
    location.counts.night = 1
    location.nightEncounters = id === 'factory'
      ? [{ type: 'titan', count: 1, weight: 70 }, { type: 'fly', count: 1, weight: 10 }, { type: 'octopus', count: 3, weight: 10 }, { type: 'patrol', count: 3, weight: 10 }]
      : id === 'center'
        ? [{ type: 'patrol', count: 3, weight: 40 }, { type: 'patrol', count: 2, weight: 30 }, { type: 'fly', count: 1, weight: 20 }, { type: 'octopus', count: 3, weight: 10 }]
        : [{ type: 'patrol', count: 2, weight: 50 }, { type: 'patrol', count: 1, weight: 30 }, { type: 'fly', count: 1, weight: 10 }, { type: 'octopus', count: 2, weight: 10 }]
  }
  const expected = location => location === 'center' ? [['patrol', 3, 400], ['patrol', 2, 300], ['fly', 1, 200], ['octopus', 3, 100]] : [['patrol', 2, 500], ['patrol', 1, 300], ['fly', 1, 100], ['octopus', 2, 100]]
  const noRoll = () => { throw new Error('unexpected roll') }
  for (const location of Object.keys(config.locations)) {
    const locationExpected = location === 'factory'
      ? [['titan', 1, 700], ['fly', 1, 100], ['octopus', 3, 100], ['patrol', 3, 100]]
      : expected(location)
    const totals = new Map()
    let calls = 0
    for (let i = 0; i < 1000; i++) {
      const result = resolvePatrolEncounter(config, location, 'night', () => { calls++; return i / 1000 })
      const type = Object.keys(config.types).find(id => config.types[id] === result.definition)
      const key = type + ':' + result.count
      totals.set(key, (totals.get(key) ?? 0) + 1)
    }
    assert.equal(calls, 1000)
    assert.deepEqual([...totals], locationExpected.map(([type, count, frequency]) => [type + ':' + count, frequency]), location)
    for (const phase of ['morning', 'afternoon', 'evening']) {
      assert.deepEqual(resolvePatrolEncounter(config, location, phase, noRoll), resolvePatrolPopulation(config, location, phase))
    }
    const disabled = structuredClone(config)
    disabled.locations[location].enabled = false
    assert.equal(resolvePatrolEncounter(disabled, location, 'night', noRoll), undefined)
  }
  assert.equal(resolvePatrolEncounter(config, 'missing', 'night', noRoll), undefined)
  assert.equal(resolveIndoorPatrolPopulations(config, 'factory', 'night')[0].definition.name, 'Octopus')
})

test('monster content rejects missing fear, short aura radii, and invalid interior bindings', () => {
  for(const mutate of [
    data=>{delete data.patrols.types.octopus.combat.fear},
    data=>{data.patrols.types.octopus.combat.fear.radius=240},
    data=>{data.patrols.locations.factory.interiors[0].buildingId='missing'},
    data=>{data.patrols.locations.factory.interiors[0].floor=99},
    data=>{data.patrols.locations.factory.interiors[0].type='missing'},
    data=>{data.patrols.locations.factory.interiors[0].bounds.left=0.99},
    data=>{data.patrols.locations.factory.nightEncounters=[]},
    data=>{data.patrols.locations.factory.nightEncounters[0].count=-1},
    data=>{data.patrols.locations.factory.nightEncounters[0].count=0.5},
    data=>{data.patrols.locations.factory.nightEncounters[0].weight=0},
    data=>{data.patrols.locations.factory.nightEncounters[0].type='missing'},
  ]) {
    const {data,sources}=catalogue()
    data.patrols.locations.factory.nightEncounters = [{ type: 'titan', count: 1, weight: 1 }]
    mutate(data)
    assert.throws(()=>validateContent(data,sources),/patrols/)
  }
})
