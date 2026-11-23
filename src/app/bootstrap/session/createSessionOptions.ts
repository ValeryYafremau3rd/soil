import { DIFFICULTIES, difficultyRules } from '../../../content/difficulty'
import type { Character } from '../../../domain/skills/character'
import { closeGameTab } from '../../../platform/closeGameTab'
import { gameSaveStorage } from '../../../platform/storage/gameSaveStorage'
import type { SaveGame, SaveStorage } from '../../contracts/save'
import { validateSave } from '../../persistence/validateSave'
import { PerksService } from '../../services/character/PerksService'
import { StatusService } from '../../services/character/StatusService'
import { InventoryService } from '../../services/inventory/InventoryService'
import { NotesService } from '../../services/progression/NotesService'
import { StatisticsService } from '../../services/progression/StatisticsService'
import { LockpickingService } from '../../services/puzzles/LockpickingService'
import { QuestService } from '../../services/quests/QuestService'
import { OptionsService } from '../../services/session/OptionsService'
import { MessageService } from '../../services/ui/MessageService'
import { DayTimeService } from '../../services/world/DayTimeService'
import { TravelService } from '../../services/world/TravelService'
import { GAME_VERSION } from '../../version'
import { createSessionDialogue } from './createSessionDialogue'
import { createSaveReferences } from './createSaveReferences'

/** Optional persistence and application lifecycle adapters for a session. */
export interface SessionOptions {
  saved?: SaveGame
  storage?: SaveStorage
  onLoad?: (save: SaveGame) => void
  onRestart?: () => void
}

/** Snapshot readers required to capture a coherent save on demand. */
interface SaveSetup {
  story: import('../../contracts/story').StoryController
  options: SessionOptions
  references: ReturnType<typeof createSaveReferences>
  saved?: SaveGame
  getCharacter: () => Character | null
  getDifficulty: () => ReturnType<typeof difficultyRules>
  selectDifficulty: (id: string) => void
  getAwakePhases: () => number
  status: StatusService
  travel: TravelService
  daytime: DayTimeService
  inventory: InventoryService
  quests: QuestService
  statistics: StatisticsService
  perks: PerksService
  notes: NotesService
  dialogue: ReturnType<typeof createSessionDialogue>
  lockpicking: LockpickingService
  messages: MessageService
}

/**
 * Compose save capture, validation, storage and application lifecycle actions.
 * @param {SaveSetup} setup - Snapshot readers and platform callbacks for this session.
 * @returns {OptionsService} Options service that captures current state only when requested.
 */
export function createSessionOptions({
  options, references, saved, getCharacter, getDifficulty, selectDifficulty, getAwakePhases,
  status, travel, daytime, inventory, quests, statistics, perks, notes,
  dialogue, lockpicking, messages, story,
}: SaveSetup): OptionsService {
  return new OptionsService(
    options.storage ?? gameSaveStorage,
    position => {
      const character = getCharacter()
      const difficulty = getDifficulty()
      if (!character || status.getSnapshot().health <= 0 || position.locationId !== travel.getSnapshot().currentLocationId) return null

      return {
        version: 1,
        gameVersion: GAME_VERSION,
        openingVersion: 1,
        escapeCluesVersion: 1,
        savedAt: new Date().toISOString(),
        classId: character.classId,
        difficultyId: difficulty.id,
        daytime: daytime.getSnapshot(),
        status: status.getSnapshot(),
        inventory: inventory.saveState(),
        quests: quests.getSnapshot().progress,
        story: story.getSnapshot(),
        ...(saved?.legacyQuestPrerequisites
          ? { legacyQuestPrerequisites: saved.legacyQuestPrerequisites } : {}),
        courierBoard: quests.getSnapshot().courierBoard,
        npcJobs: quests.getSnapshot().npcJobs,
        statistics: statistics.getSnapshot(),
        perks: perks.getSnapshot(),
        notes: notes.getSnapshot(),
        awakePhases: getAwakePhases(),
        intimidatedDays: dialogue.saveState(),
        adviceDays: dialogue.saveAdviceState(),
        travel: travel.saveState(),
        unlockedDoors: lockpicking.saveState(),
        position
      }
    },
    value => validateSave(value, references),
    options.onLoad ?? (() => { }),
    options.onRestart ?? (() => { }),
    messages.show,
    saved?.position,
    () => closeGameTab(() => messages.show('Your browser blocked closing this tab. Close the tab to exit the game.')),
    {
      ids: DIFFICULTIES.presets.map(preset => preset.id),
      getId: () => getDifficulty().id,
      select: selectDifficulty,
    }
  )
}
