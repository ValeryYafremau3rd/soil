import assert from 'node:assert/strict'
import test from 'node:test'
import { lootTableFiles } from '../../src/app/content/lootTableFiles.ts'
import { contentFiles, content } from '../helpers/content.mjs'

test('vendor and corpse tables expand without mutating authored references', () => {
  const files = {
    './dialogues/vendor.json': { barter: { stockTable: 'shop' } },
    './patrols/types/guard/index.json': { corpseLootTable: 'guard' },
    './loot-tables/vendors/shop.json': { offers: [{ itemId: 'bandage', chance: 0.5 }] },
    './loot-tables/corpses/guard.json': [{ itemId: 'bandage', min: 1, max: 2, chance: 0.25 }],
  }
  const before = structuredClone(files)
  const expanded = lootTableFiles(files)
  assert.deepEqual(files, before)
  assert.deepEqual(expanded['./dialogues/vendor.json'].barter.stock,
    files['./loot-tables/vendors/shop.json'])
  assert.deepEqual(expanded['./patrols/types/guard/index.json'].corpseLoot,
    files['./loot-tables/corpses/guard.json'])
})

test('missing, unsafe and conflicting table references fail with their source path', () => {
  for (const owner of [
    { stockTable: 'missing' },
    { stockTable: '../escape' },
    { stockTable: 'shop', stock: {} },
  ]) {
    assert.throws(() => lootTableFiles({
      './dialogues/vendor.json': owner,
      './loot-tables/vendors/shop.json': {},
    }), /dialogues\/vendor.json/)
  }
})

test('authored vendor and corpse references preserve all offer and drop values', () => {
  const files = contentFiles()
  const expanded = lootTableFiles(files)
  for (const [path, owner] of Object.entries(files)) {
    if (owner.corpseLootTable) {
      assert.deepEqual(expanded[path].corpseLoot,
        files[`./loot-tables/corpses/${owner.corpseLootTable}.json`])
    }
    for (const [index, barter] of [owner.barter, ...(owner.barters ?? [])].entries()) {
      if (!barter?.stockTable) continue
      const resolved = index === 0 ? expanded[path].barter : expanded[path].barters[index - 1]
      assert.deepEqual(resolved.stock, files[`./loot-tables/vendors/${barter.stockTable}.json`])
    }
  }
  assert.ok(Object.keys(content().containers.lootTables).length > 0)
})
