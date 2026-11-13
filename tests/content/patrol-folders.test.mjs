import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { contentFiles } from '../helpers/content.mjs'

test('patrol animation folders assemble identically to flat definitions', () => {
  const files = contentFiles()
  const split = assembleContent(files)
  const flatFiles = Object.fromEntries(Object.entries(files).filter(([path]) => !/^\.\/patrols\/types\//.test(path)))
  for (const [id, definition] of Object.entries(split.data.patrols.types)) flatFiles[`./patrols/types/${id}.json`] = definition
  assert.deepEqual(assembleContent(flatFiles).data, split.data)
  validateContent(split.data, split.sources)
})

test('invalid patrol frames report their animation source file', () => {
  const files = contentFiles()
  files['./patrols/types/patrol/animations/walk.json'].frameRate = -1
  const catalogue = assembleContent(files)
  assert.throws(() => validateContent(catalogue.data, catalogue.sources), /patrols\/types\/patrol\/animations\/walk.json.frameRate/)
})

test('patrol folders reject missing animations, duplicate definitions and unrecognized files', () => {
  for (const [mutate, message] of [
    [files => { delete files['./patrols/types/patrol/animations/attack.json'] }, /attack.json: expected an object/],
    [files => { files['./patrols/types/patrol.json'] = {} }, /duplicate patrol file/],
    [files => { files['./patrols/types/patrol/animations/wlak.json'] = {} }, /unrecognized patrol content file/],
    [files => { files['./patrols/types/patrol/index.json'].walk = {} }, /walk belongs in/],
    [files => { files['./patrols/types/patrol/animations/idle.json'].typo = 1 }, /unknown idle field/],
  ]) {
    const files = contentFiles()
    mutate(files)
    assert.throws(() => assembleContent(files), message)
  }
})
