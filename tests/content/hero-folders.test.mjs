import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { contentFiles } from '../helpers/content.mjs'

test('hero animation folders assemble identically to the flat definition', () => {
  const files = contentFiles()
  const split = assembleContent(files)
  const flat = Object.fromEntries(Object.entries(files).filter(([path]) => !path.startsWith('./hero/')))
  flat['./hero.json'] = split.data.hero
  assert.deepEqual(assembleContent(flat).data, split.data)
  validateContent(split.data, split.sources)
})

test('invalid hero crops and timing identify their animation files', () => {
  for (const [field, value, pattern] of [
    ['frameRate', 0, /hero\/animations\/idle.json.frameRate/],
    ['steps', [{ x: -1 }], /hero\/animations\/idle.json.steps/],
    ['typo', 1, /hero\/animations\/idle.json.typo/],
  ]) {
    const files = contentFiles()
    files['./hero/animations/idle.json'][field] = value
    const catalogue = assembleContent(files)
    assert.throws(() => validateContent(catalogue.data, catalogue.sources), pattern)
  }
})

test('hero folders reject missing animations, duplicate definitions and unrecognized files', () => {
  for (const [mutate, pattern] of [
    [files => { delete files['./hero/animations/jump.json'] }, /jump.json: expected an object/],
    [files => { files['./hero.json'] = {} }, /duplicate hero file/],
    [files => { files['./hero/animations/idlle.json'] = {} }, /unrecognized hero content file/],
    [files => { files['./hero/index.json'].steps = {} }, /steps and timing belong in animation files/],
    [files => { files['./hero/index.json'].actions.jump = 'hero-idle' }, /duplicate animation key/],
  ]) {
    const files = contentFiles()
    mutate(files)
    assert.throws(() => assembleContent(files), pattern)
  }
})
