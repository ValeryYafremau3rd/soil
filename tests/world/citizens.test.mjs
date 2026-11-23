import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { DAY_PHASES } from '../../src/app/contracts/daytime.ts'
import { resolveNpcPlacements } from '../../src/app/content/resolveNpcPlacements.ts'

test('all citizens have six anchored poses within the supplied sheet', () => {
  const { npcs } = content()
  const citizens = Object.entries(npcs).filter(([id]) => id.startsWith('citizen-'))
  assert.equal(citizens.length, 4)
  const rows = []
  for (const [id, npc] of citizens) {
    assert.equal(npc.path, `assets/characters/npc/${id === 'citizen-caretaker' ? 'caretaker' : 'citizens'}.png`)
    const png = readFileSync(new URL(`../../public/${npc.path}`, import.meta.url))
    assert.equal(npc.idleSteps.length, 6, id)
    const ratio = png.readUInt32BE(16) / npc.referenceWidth
    for (const frame of npc.idleSteps) {
      assert.ok((frame.x + frame.width) * ratio <= png.readUInt32BE(16), id)
      assert.ok((frame.y + frame.height) * ratio <= png.readUInt32BE(20), id)
      assert.ok(frame.anchorY <= frame.height && frame.anchorX <= frame.width, id)
    }
    rows.push(`${npc.path}:${npc.idleSteps[0].y}`)
    assert.equal(Object.keys(npc.schedule).length, DAY_PHASES.length)
  }
  assert.equal(new Set(rows).size, 4)
})

test('citizens appear once per phase and Living District rooms never contain more than two people', () => {
  const { npcs, locations } = content()
  for (const phase of DAY_PHASES) {
    const roster = locations.flatMap(location => resolveNpcPlacements(npcs, locations, location.id, phase)
      .map(npc => ({ ...npc, locationId: location.id })))
    for (const id of Object.keys(npcs).filter(id => id.startsWith('citizen-'))) {
      assert.equal(roster.filter(npc => npc.type === id).length, 1, `${phase}: ${id}`)
    }
    const counts = new Map([['apartments:apartment-21', 1]]) // Include the hero's reserved room.
    for (const npc of roster.filter(npc => npc.locationId === 'living-district' && npc.roomId)) {
      const key = `${npc.buildingId}:${npc.roomId}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
      assert.ok(counts.get(key) <= 2, `${phase}: ${key}`)
    }
  }
  const night = resolveNpcPlacements(npcs, locations, 'living-district', 'night')
  for (const [id, room] of [['citizen-mechanic', '12'], ['citizen-nurse', '22'], ['citizen-clerk', '32'], ['citizen-caretaker', '42']]) {
    assert.equal(night.find(npc => npc.type === id).roomId, `apartment-${room}`)
  }
})

test('new citizens on ground floors leave building doors clear for entry and exit', () => {
  const { npcs, locations, buildings } = content()
  for (const [id, npc] of Object.entries(npcs).filter(([id]) => id.startsWith('citizen-'))) {
    for (const [phase, placement] of Object.entries(npc.schedule)) {
      if (!placement.buildingId || placement.roomId || (placement.floor ?? 0) !== 0) continue
      const location = locations.find(location => location.id === placement.locationId)
      const instance = location.buildings.find(building => building.id === placement.buildingId)
      const building = buildings[instance.type]
      const scale = building.scale * (instance.scale ?? 1)
      for (const door of building.entrances ?? [building.entranceX]) {
        assert.ok(Math.abs(placement.x - door) * scale > npc.interactionRadius, `${id}: ${phase}`)
      }
    }
  }
})
