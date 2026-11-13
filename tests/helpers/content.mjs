import { readFileSync, readdirSync } from 'node:fs'
import { assembleContent } from '../../src/app/content/assembleContent.ts'

export function contentFiles() {
  const root = new URL('../../src/content/', import.meta.url)
  const files = {}
  function visit(folder = '') {
    for (const entry of readdirSync(new URL(folder, root), { withFileTypes: true })) {
      const path = `${folder}${entry.name}`
      if (entry.isDirectory() && path !== 'examples') visit(`${path}/`)
      else if (entry.isFile() && path.endsWith('.json')) files[`./${path}`] = JSON.parse(readFileSync(new URL(path, root), 'utf8').replace(/^\uFEFF/, ''))
    }
  }
  visit()
  return files
}

export function catalogue() { return assembleContent(contentFiles()) }
export function content() { return catalogue().data }
