import { validateShape } from '../content/schema.ts'
import type { SaveGame } from '../contracts/save'
import { assertSaveCompatibility } from '../version.ts'
import { migrateDeliveries } from './migrateDeliveries.ts'
import { migrateOpening } from './migrateOpening.ts'
import { migrateEscapeClues } from './migrateEscapeClues.ts'
import { migrateMotherJournal } from './migrateMotherJournal.ts'
import { migrateReading } from './migrateReading.ts'
import { migrateRetiredQuests } from './migrateRetiredQuests.ts'
import { migrateStoredItems } from './migrateStoredItems.ts'
import type { SaveReferences } from './saveReferences.ts'
import { saveSchema } from './saveSchema.ts'
import { validateSavedIdentity } from './validateSavedIdentity.ts'
import { validateSavedInventory } from './validateSavedInventory.ts'
import { validateSavedQuests } from './validateSavedQuests.ts'
import { validateSavedWorld } from './validateSavedWorld.ts'
import { validateSavedStory } from './validateSavedStory.ts'
import { migrateStoryPrerequisites } from './migrateStoryPrerequisites.ts'
export type { SaveReferences } from './saveReferences.ts'

/**
 * Validate save against the supported rules.
 * @param {unknown} value - The value supplied to this operation.
 * @param {SaveReferences} references - The references supplied to this operation.
 * @returns {SaveGame} The result described by the TypeScript return signature.
 */
export function validateSave(
  value: unknown,
  references: SaveReferences
): SaveGame {
  validateShape(value, saveSchema, 'save')
  const save = structuredClone(value) as SaveGame
  assertSaveCompatibility(save.gameVersion)
  migrateRetiredQuests(save)
  migrateOpening(save, references)
  migrateEscapeClues(save, references)
  migrateStoryPrerequisites(save, references)
  migrateReading(save)
  migrateDeliveries(save, references)
  migrateStoredItems(save, references)
  if (references.items.some(item => item.id === 'milena-mother-journal')) save.inventory = migrateMotherJournal(save.inventory)

  validateSavedIdentity(save, references)
  validateSavedInventory(save, references)
  validateSavedQuests(save, references)
  validateSavedWorld(save, references)
  validateSavedStory(save, references)

  return structuredClone(save)
}
