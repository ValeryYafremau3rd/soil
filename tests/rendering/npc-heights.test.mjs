import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { resolveNpcPlacements } from '../../src/app/content/resolveNpcPlacements.ts'
import { interiorNpcScale } from '../../src/game/rendering/interiorNpcScale.ts'
import { interiorClearance } from '../../src/domain/buildings/navigation.ts'

test('every resident schedule and idle frame stays near the standing hero height', () => {
  const data = content()
  const { settings, steps, actions } = data.hero
  const heroHeight = steps[actions.idle][0].height * steps[actions.idle][0].scale
  const { interiorHeadroom, minimumInteriorHeight } = data.settings.interaction
  const minimum = interiorClearance(0, minimumInteriorHeight, settings.frameHeight * settings.scale, interiorHeadroom)
  let cases = 0
  const contexts = new Set()
  for (const phase of ['morning', 'afternoon', 'evening', 'night']) {
    for (const location of data.locations) {
      for (const placement of resolveNpcPlacements(data.npcs, data.locations, location.id, phase)) {
        const definition = data.npcs[placement.type]
        let scale = definition.scale * placement.scale
        let clearance = Infinity
        if (placement.buildingId) {
          const instance = location.buildings.find(building => building.id === placement.buildingId)
          const building = data.buildings[instance.type]
          const room = building.rooms?.find(room => room.id === placement.roomId)
          const floor = building.inner.floors[room?.floor ?? placement.floor ?? 0]
          const height = room ? data.rooms[room.type].groundY - data.rooms[room.type].bounds.ceiling : floor.y - floor.ceiling
          clearance = Math.max(height * building.scale * (instance.scale ?? 1), minimum)
          scale = interiorNpcScale(definition, settings, clearance, interiorHeadroom)
        }
        contexts.add(placement.roomId ? 'room' : placement.buildingId ? 'building' : 'outdoors')
        const target = heroHeight * (placement.buildingId ? settings.roomScale : settings.scale)
        for (const frame of definition.idleSteps) {
          const height = frame.height * (frame.scale ?? 1) * definition.displayHeight * scale
            / (definition.frameSize?.referenceHeight ?? definition.idleSteps[0].height)
          const label = `${placement.type}/${phase}/${location.id}/${placement.roomId ?? placement.buildingId ?? 'outside'}`
          assert.ok(height >= target * 0.85 && height <= target * 1.1, `${label}: NPC ${height}, hero ${target}`)
          assert.ok(height <= clearance - interiorHeadroom, label)
        }
        cases++
      }
    }
  }
  assert.equal(cases, Object.keys(data.npcs).length * 4)
  assert.deepEqual([...contexts].sort(), ['building', 'outdoors', 'room'])
})

test('human patrols follow the same indoor ratio and tight ceilings cap height', () => {
  const data = content()
  const human = data.patrols.types.patrol
  const hero = data.hero.settings
  const headroom = data.settings.interaction.interiorHeadroom
  const scale = interiorNpcScale(human, hero, 140, headroom)
  assert.equal(scale, human.scale * hero.roomScale / hero.scale)
  assert.equal(interiorNpcScale(human, hero, 60, headroom) * human.displayHeight, 60 - headroom)
  const resized = { ...hero, roomScale: hero.scale / 2 }
  assert.equal(interiorNpcScale(human, resized, 140, headroom), human.scale / 2)
})
