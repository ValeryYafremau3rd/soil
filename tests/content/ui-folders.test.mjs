import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { UI_CONFIG } from '../../src/content/ui.ts'
import { contentFiles } from '../helpers/content.mjs'

test('UI sections and the service adapter match the flat runtime definition', () => {
  const files = contentFiles()
  const split = assembleContent(files)
  const flat = Object.fromEntries(Object.entries(files).filter(([path]) => !path.startsWith('./ui/')))
  flat['./ui.json'] = split.data.ui
  assert.deepEqual(assembleContent(flat).data, split.data)
  assert.deepEqual(UI_CONFIG, split.data.ui)
  validateContent(split.data, split.sources)
})

test('invalid UI fields identify their section files', () => {
  for (const [mutate, pattern] of [
    [files => { files['./ui/inventory.json'].itemIconSize = 0 }, /ui\/inventory.json.itemIconSize/],
    [files => { files['./ui/location-transition.json'].fadeMs = -1 }, /ui\/location-transition.json.fadeMs/],
    [files => { files['./ui/rest.json'].energyRecovery.sleep = -1 }, /ui\/rest.json.energyRecovery.sleep/],
    [files => { files['./ui/menus.json'][1].id = files['./ui/menus.json'][0].id }, /ui\/menus.json/],
    [files => { files['./ui/perks.json'][0].goal = 0 }, /ui\/perks.json\[0\].goal/],
    [files => { files['./ui/consumable-buffs.json'][0].durationDays = 0 }, /ui\/consumable-buffs.json\[0\].durationDays/],
    [files => { files['./ui/selection-keys.json'].choose = [] }, /ui\/selection-keys.json.choose/],
    [files => { files['./ui/controls.json'][0].typo = true }, /ui\/controls.json\[0\].typo/],
    [files => { files['./ui/stats.json'][0].value = files['./ui/stats.json'][0].max + 1 }, /ui\/stats.json.health/],
  ]) {
    const files = contentFiles()
    mutate(files)
    const catalogue = assembleContent(files)
    assert.throws(() => validateContent(catalogue.data, catalogue.sources), pattern)
  }
})

test('UI sections reject missing, conflicting and unrecognized content', () => {
  for (const [mutate, pattern] of [
    [files => { delete files['./ui/rest.json'] }, /ui\/rest.json: missing UI section/],
    [files => { files['./ui.json'] = {} }, /duplicate UI definition/],
    [files => { files['./ui/menues.json'] = [] }, /unrecognized UI content file/],
    [files => { files['./ui/inventory.json'] = [] }, /inventory.json: expected an object/],
    [files => { files['./ui/inventory.json'].typo = 1 }, /inventory.json.typo: unknown inventory field/],
  ]) {
    const files = contentFiles()
    mutate(files)
    assert.throws(() => assembleContent(files), pattern)
  }
})
