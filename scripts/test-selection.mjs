import { readdirSync } from 'node:fs'
import path from 'node:path'

/** Discover new test files automatically; no suite registry needs updating. */
export function discoverTests(root) {
  const files = []
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name
      if (entry.isDirectory()) visit(path.join(directory, entry.name), relative + '/')
      else if (entry.isFile() && entry.name.endsWith('.test.mjs')) files.push(relative)
    }
  }
  visit(root)
  return files.sort()
}

export function selectTests(files, selectors = []) {
  if (!selectors.length) return [...files]
  const selected = new Set()
  for (const raw of selectors) {
    const selector = raw.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^tests\//, '').replace(/\/$/, '')
    const folder = files.filter(file => file.startsWith(selector + '/'))
    const matches = selector === 'all' ? files : folder.length ? folder : files.filter(file =>
      file === selector || file === selector + '.test.mjs'
      || path.posix.basename(file) === selector || path.posix.basename(file, '.test.mjs') === selector)
    if (!matches.length) throw new Error(`Unknown test module or file: ${raw}`)
    if (!folder.length && selector !== 'all' && matches.length > 1) throw new Error(`Ambiguous test filename: ${raw}. Include its module folder.`)
    for (const file of matches) selected.add(file)
  }
  return [...selected].sort()
}
