import { validateShape } from '../content/schema.ts'
import type { SaveGame } from '../contracts/save'
import { assertSaveCompatibility } from '../version.ts'
import { migrateDeliveries } from './migrateDeliveries.ts'
import { migrateOpening } from './migrateOpening.ts'
import { migrateStoredItems } from './migrateStoredItems.ts'
import type { SaveReferences } from './saveReferences.ts'
import { saveSchema } from './saveSchema.ts'
import { validateSavedIdentity } from './validateSavedIdentity.ts'
import { validateSavedInventory } from './validateSavedInventory.ts'
import { validateSavedQuests } from './validateSavedQuests.ts'
import { validateSavedWorld } from './validateSavedWorld.ts'
export type { SaveReferences } from './saveReferences.ts'

export function validateSave(value: unknown, references: SaveReferences): SaveGame {
validateShape(value, saveSchema, 'save')
const save=structuredClone(value) as SaveGame
assertSaveCompatibility(save.gameVersion)
migrateOpening(save,references)
migrateDeliveries(save,references)
migrateStoredItems(save,references)
validateSavedIdentity(save,references)
validateSavedInventory(save,references)
validateSavedQuests(save,references)
validateSavedWorld(save,references)
return structuredClone(save)
}
