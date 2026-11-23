import { contentFiles } from './content.mjs'
import { assembleContent } from '../../src/app/content/assembleContent.ts'
import fixture from '../fixtures/strap-quest.json' with { type: 'json' }

/**
 * Assemble the retired example only for generic quest behavior and validation tests.
 * @returns {ReturnType<typeof assembleContent>} Real content with an isolated example quest.
 */
export function strapQuestCatalogue() {
  const files = contentFiles()
  files['./uests/a-fraying-strap.json'] = structuredClone(fixture.quest)
  const dialogue = files['./dialogues/bartender.json']
  dialogue.nodes.greeting.choices.push(...structuredClone(fixture.choices))
  Object.assign(dialogue.nodes, structuredClone(fixture.nodes))
  return assembleContent(files)
}
