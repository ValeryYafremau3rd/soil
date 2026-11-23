import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('configured sound files exist and audio references and volumes are validated', () => {
  const input = content()
  validateContent(input)
  for (const track of Object.values(input.audio.tracks)) {
    assert.ok(existsSync(new URL(`../../src/sounds/${track.path}`, import.meta.url)), track.path)
  }
  for (const mutate of [
    audio => { audio.events.shot = 'missing' },
    audio => { audio.locations.unknown = [] },
    audio => { audio.masterVolume = 1.1 },
    audio => { audio.locations.factory[0].inside = -1 },
  ]) {
    const broken = structuredClone(input)
    mutate(broken.audio)
    assert.throws(() => validateContent(broken), /audio.json/)
  }
})
