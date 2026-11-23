import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import { contentFiles } from '../helpers/content.mjs'

test('category folders preserve item data and ordering from flat discovery', () => {
  const files = contentFiles()
  const flat = {}
  for (const [path, value] of Object.entries(files)) {
    flat[path.startsWith('./items/') ? `./items/${path.split('/').at(-1)}` : path] = value
    if (path.startsWith('./items/')) {
      assert.equal(path.split('/')[2], value.category.toLowerCase())
    }
  }
  const nested = assembleContent(files)
  const legacy = assembleContent(flat)
  assert.deepEqual(nested.data, legacy.data)
  for (const item of nested.data.items) {
    assert.equal(nested.sources[`items.json.${item.id}`],
      `src/content/items/${item.category.toLowerCase()}/${item.id}.json`)
  }
})

test('nested item filenames must still match their IDs', () => {
  const files = contentFiles()
  files['./items/medical/bandage.json'].id = 'incorrect'
  assert.throws(() => assembleContent(files),
    /items\/medical\/bandage.json: id must match/)
})
