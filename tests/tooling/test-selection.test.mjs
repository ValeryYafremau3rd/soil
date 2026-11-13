import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { discoverTests, selectTests } from '../../scripts/test-selection.mjs'

test('module discovery includes new nested test files and excludes helpers and docs', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'soil-test-discovery-'))
  t.after(() => {
    const relative = path.relative(tmpdir(), root)
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative))
    assert.match(path.basename(root), /^soil-test-discovery-/)
    rmSync(root, { recursive: true, force: true })
  })
  mkdirSync(path.join(root, 'inventory', 'nested'), { recursive: true })
  mkdirSync(path.join(root, 'helpers'))
  writeFileSync(path.join(root, 'inventory', 'trade.test.mjs'), '')
  writeFileSync(path.join(root, 'inventory', 'nested', 'new.test.mjs'), '')
  writeFileSync(path.join(root, 'helpers', 'content.mjs'), '')
  writeFileSync(path.join(root, 'README.md'), '')
  assert.deepEqual(discoverTests(root), ['inventory/nested/new.test.mjs', 'inventory/trade.test.mjs'])
})

test('focused module runs combine and deduplicate without pulling in unrelated modules', () => {
  const files = ['inventory/trade.test.mjs', 'persistence/save.test.mjs', 'quests/quests.test.mjs']
  assert.deepEqual(selectTests(files, ['quests', 'inventory', 'inventory/trade']), [files[0], files[2]])
  assert.deepEqual(selectTests(files), files)
  assert.deepEqual(selectTests(files, ['all']), files)
  assert.deepEqual(selectTests(files, ['tests\\persistence\\save.test.mjs']), [files[1]])
  assert.deepEqual(selectTests(files, ['trade']), [files[0]])
})

test('misspelled selectors and ambiguous filenames fail instead of silently running zero or unrelated tests', () => {
  const files = ['inventory/common.test.mjs', 'quests/common.test.mjs']
  assert.throws(() => selectTests(files, ['inventroy']), /Unknown test module/)
  assert.throws(() => selectTests(files, ['common']), /Ambiguous test filename/)
  assert.throws(() => selectTests(files, ['../src']), /Unknown test module/)
})
