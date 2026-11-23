import { BUILDINGS } from '../../../content/buildings'
import { CONTENT } from '../../../content/catalogue'
import { CLASSES } from '../../../content/classes'
import { CONTAINER_SEEDS, VEHICLE_SEEDS } from '../../../content/containers'
import { DAYTIME_CONFIG } from '../../../content/daytime'
import { DIALOGUES } from '../../../content/dialogues'
import { DIFFICULTIES } from '../../../content/difficulty'
import { ITEMS } from '../../../content/items'
import { LOCATIONS } from '../../../content/locations'
import { ROOMS } from '../../../content/rooms'
import type { QuestDefinition } from '../../../domain/quests/quests'
import { buildVendorSeeds } from '../../content/vendorSeeds'
import type { SaveReferences } from '../../persistence/validateSave'

/**
 * Build the content references used to validate saved sessions.
 * @returns {SaveReferences} Required and optional IDs, with world definitions.
 */
export function createSaveReferences(): SaveReferences {
  return {
    story: CONTENT.data.story as import('../../../domain/quests/story').StoryConfig,
    classIds: CLASSES.map(entry => entry.id),
    difficultyIds: DIFFICULTIES.presets.map(entry => entry.id),
    locations: LOCATIONS,
    items: ITEMS,
    quests: CONTENT.data.quests as QuestDefinition[],
    buildings: BUILDINGS,
    rooms: ROOMS,
    containerIds: [
      ...CONTAINER_SEEDS.map(entry => entry.id),
      ...buildVendorSeeds(DIALOGUES, ITEMS).map(entry => entry.id)
    ],
    optionalContainerIds: [
      ...VEHICLE_SEEDS.map(seed => seed.id),
      ...CONTAINER_SEEDS.filter(entry => entry.questId || entry.questIds?.length
        || entry.id.endsWith(':room-21-storage')).map(entry => entry.id),
      ...buildVendorSeeds(DIALOGUES, ITEMS).filter(entry => entry.requiresQuest || entry.id === 'merchant:citizen-nurse').map(entry => entry.id)
    ],
    travelsPerPhase: DAYTIME_CONFIG.travelsPerPhase,
    npcIds: Object.keys(CONTENT.data.npcs as object)
  }
}
