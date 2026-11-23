import { validateAudio } from './validation/validateAudio.ts'
import type { AudioConfig } from '../contracts/audio.ts'
import { CONFIG_SCHEMAS } from './configSchemas.ts'
import type { ContentInput } from './contentInput.ts'
import { validateShape } from './schema.ts'
import { contentContext } from './validation/context.ts'
import { validateActors } from './validation/validateActors.ts'
import { validateBalance } from './validation/validateBalance.ts'
import { validateBuildings } from './validation/validateBuildings.ts'
import { validateDialogues } from './validation/validateDialogues.ts'
import { validateHeroAnimations } from './validation/validateHeroAnimations.ts'
import { validateItems } from './validation/validateItems.ts'
import { validateLocations } from './validation/validateLocations.ts'
import { validateLoot } from './validation/validateLoot.ts'
import { validatePatrolPopulations } from './validation/validatePatrolPopulations.ts'
import { validatePerks } from './validation/validatePerks.ts'
import { validatePlacedObjects } from './validation/validatePlacedObjects.ts'
import { validatePresentation } from './validation/validatePresentation.ts'
import { validateQuests } from './validation/validateQuests.ts'
import { validateRooms } from './validation/validateRooms.ts'
import { validateSkillRewards } from './validation/validateSkillRewards.ts'
import { validateTaskboards } from './validation/validateTaskboards.ts'
import { validateStory } from './validation/validateStory.ts'
import type { StoryConfig } from '../../domain/quests/story'
export type { ContentInput } from './contentInput.ts'

/**
 * Validate content against the supported rules.
 * @param {ContentInput} input - The input supplied to this operation.
 * @param {Readonly<Record<string, string>>} sources - The sources supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateContent(
  input: ContentInput,
  sources: Readonly<Record<string, string>> = {}
): void {
  try {
    validateCatalogue(input)
  } catch (error) {
    if (!(error instanceof Error)) throw error

    const prefix = Object.keys(sources).sort((a, b) => b.length - a.length).find(path =>
      error.message.startsWith(path) && ['.', '[', ':'].includes(error.message[path.length]))
    if (prefix) throw new Error(sources[prefix] + error.message.slice(prefix.length), { cause: error })

    throw error
  }
}

/**
 * Validate catalogue against the supported rules.
 * @param {ContentInput} input - The input supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
function validateCatalogue(input: ContentInput): void {
  for (const [name, schema] of Object.entries(CONFIG_SCHEMAS)) validateShape(input[name as keyof ContentInput], schema, `${name}.json`)

  const context = contentContext(input)
  validateAudio(input.audio as AudioConfig, context.locations)
  validateBalance(context)
  validatePerks(context)
  validateSkillRewards(context)
  validateQuests(context)
  validateStory(input.story as StoryConfig, context)
  validatePresentation(context)
  validateItems(context)
  validateRooms(context)
  validateBuildings(context)
  validateDialogues(context)
  validateActors(context)
  validatePatrolPopulations(context)
  validateLocations(context)
  validateLoot(context)
  validatePlacedObjects(context)
  validateTaskboards(context)
  validateHeroAnimations(context)
}
