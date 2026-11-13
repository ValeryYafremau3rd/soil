import { assembleContent } from '../app/content/assembleContent'

// New files are discovered automatically; examples are never game content.
export const CONTENT = assembleContent(import.meta.glob(['./**/*.json', '!./examples/**'], {
  eager: true, import: 'default',
}))
