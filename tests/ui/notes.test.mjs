import test from 'node:test'
import assert from 'node:assert/strict'
import { NotesService } from '../../src/app/services/progression/NotesService.ts'

const catalogue = { locations: ['home', 'center'], people: ['viktor'], items: ['scrap', 'tool'] }

test('all notes are available before visiting, talking or collecting', () => {
  const notes = new NotesService(catalogue)
  assert.deepEqual(notes.getSnapshot(), catalogue)
  const before = notes.getSnapshot()
  notes.visitLocation('center')
  notes.meetPerson('viktor')
  notes.meetPerson('unknown')
  notes.discoverItems(['tool', 'unknown'])
  assert.equal(notes.getSnapshot(), before, 'tracking cannot duplicate or add unknown entries')
})

test('loading old partial or empty notes retains the complete current catalogue', () => {
  const notes = new NotesService(catalogue)
  for (const saved of [
    { locations: [], people: [], items: [] },
    { locations: ['home', 'unknown'], people: [], items: ['scrap', 'scrap'] },
  ]) {
    notes.restoreState(saved)
    assert.deepEqual(notes.getSnapshot(), catalogue)
  }
})
