import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { expandHeroOutfitFiles } from '../../src/app/content/expandHeroOutfitFiles.ts'
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
    ['frameRate', 0, /hero\/outfits\/basic\/animations\/idle.json.frameRate/],
    ['steps', [{ x: -1 }], /hero\/outfits\/basic\/animations\/idle.json.steps/],
    ['typo', 1, /hero\/outfits\/basic\/animations\/idle.json.typo/],
  ]) {
    const files = contentFiles()
    files['./hero/outfits/basic/animations/idle.json'][field] = value
    const catalogue = assembleContent(files)
    assert.throws(() => validateContent(catalogue.data, catalogue.sources), pattern)
  }
})

test('outfit files preserve inline definitions and identify validation errors', () => {
  const files = contentFiles()
  const split = assembleContent(files)
  const inline = expandHeroOutfitFiles(files, {})
  inline['./hero/index.json'].outfits = split.data.hero.outfits
  for (const path of Object.keys(inline)) {
    if (path.startsWith('./hero/outfits/')) delete inline[path]
  }
  assert.deepEqual(assembleContent(inline).data, split.data)
  files['./hero/outfits/chef-jacket/animations/idle.json'].steps[0].x = -1
  const invalid = assembleContent(files)
  assert.throws(() => validateContent(invalid.data, invalid.sources), /hero\/outfits\/chef-jacket\/animations\/idle.json/)
})

test('hero folders reject missing animations, duplicate definitions and unrecognized files', () => {
  for (const [mutate, pattern] of [
    [files => { files['./hero/index.json'].outfits = {} }, /outfits defined both inline/],
    [files => { files['./hero/outfits/chef-jacket/index.json'] = [] }, /chef-jacket\/index.json: expected an object/],
    [files => { delete files['./hero/outfits/basic/animations/jump.json'] }, /jump.json: expected an object/],
    [files => { files['./hero.json'] = {} }, /duplicate hero file/],
    [files => { files['./hero/outfits/basic/animations/idlle.json'] = {} }, /unrecognized hero content file/],
    [files => { files['./hero/index.json'].steps = {} }, /steps and timing belong in animation files/],
    [files => { files['./hero/index.json'].actions.jump = 'hero-idle' }, /duplicate animation key/],
  ]) {
    const files = contentFiles()
    mutate(files)
    assert.throws(() => assembleContent(files), pattern)
  }
})

test('basic outfit and clothing animations are required and ownership conflicts are rejected', () => {
  for (const [mutate, pattern] of [
    [files => { files['./hero/index.json'].basicOutfit = 'missing' }, /unknown outfit missing/],
    [files => { delete files['./hero/outfits/work-jacket/animations/run.json'] }, /work-jacket\/animations\/run.json/],
    [files => { files['./hero/animations/idle.json'] = {} }, /duplicate animation/],
    [files => { files['./hero/index.json'].asset = {} }, /asset belongs to the basic outfit/],
    [files => { files['./hero/outfits/chef-jacket/animations/idle.json'].frameRate = 10 }, /timing is shared/],
  ]) {
    const files = contentFiles()
    mutate(files)
    assert.throws(() => assembleContent(files), pattern)
  }
})

test('outfit discovery never mutates authored content and maps basic asset diagnostics', () => {
  const files = contentFiles()
  const before = structuredClone(files)
  const catalogue = assembleContent(files)
  assert.deepEqual(files, before)
  assert.equal(catalogue.sources['hero.json.asset'],
    'src/content/hero/outfits/basic/index.json.asset')
  assert.equal('basic' in catalogue.data.hero.outfits, false)
})
