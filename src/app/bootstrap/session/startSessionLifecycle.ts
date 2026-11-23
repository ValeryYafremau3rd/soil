import type { GameServices } from '../../contracts/game'
import { StatusService } from '../../services/character/StatusService'
import { refreshContainersEachMorning } from '../../services/inventory/refreshContainersEachMorning'
import { NotesService, trackNotes } from '../../services/progression/NotesService'
import { StatisticsService } from '../../services/progression/StatisticsService'
import { LockpickingService } from '../../services/puzzles/LockpickingService'
import { QuestService } from '../../services/quests/QuestService'
import { coordinateWindows } from '../../services/session/coordinateWindows'
import { MessageService } from '../../services/ui/MessageService'
import { DayTimeService } from '../../services/world/DayTimeService'
import { TravelService } from '../../services/world/TravelService'
import type { StoryService } from '../../services/progression/StoryService'

import type { SaveGame } from '../../contracts/save'
import type { InventoryService } from '../../services/inventory/InventoryService'

/** Restoration capabilities used only after all session services exist. */
interface LifecycleSetup {
  story: StoryService
  services: GameServices
  saved?: SaveGame
  classId?: string
  inventory: InventoryService
  quests: QuestService
  travel: TravelService
  lockpicking: LockpickingService
  status: StatusService
  notes: NotesService
  messages: MessageService
  daytime: DayTimeService
  statistics: StatisticsService
  enableTracking: () => void
  hasCharacter: () => boolean
}

/**
 * Restore saves in order, then start quest, travel, note and morning-refresh observers.
 * @param {LifecycleSetup} setup - Initialized stores and optional saved session.
 * @returns {void} Activates gameplay observers after startup grants and restoration.
 */
export function startSessionLifecycle({
  services, saved, classId, inventory, quests, travel, lockpicking, status,
  notes, messages, daytime, statistics, enableTracking, hasCharacter, story,
}: LifecycleSetup): void {
  coordinateWindows(services)
  refreshContainersEachMorning(daytime, inventory)
  if (saved) {
    services.chooseClass(saved.classId, saved.difficultyId)
    inventory.restoreState(saved.inventory)
    quests.restoreState(saved.quests, saved.courierBoard, saved.npcJobs)
    travel.restoreState(saved.travel)
    lockpicking.restoreState(saved.unlockedDoors)
    status.restoreState(saved.status)
    notes.restoreState(saved.notes ?? { locations: [], people: [], items: [] })
    messages.show('Game loaded.')
  } else if (classId !== undefined) services.chooseClass(classId)

  enableTracking()
  story.restoreState(saved?.story)
  quests.startInitialQuests()
  /**
   * Release queued arrival slides after the new location has loaded and finished revealing.
   * @returns {void} Keeps scene loading independent of the story's gameplay pause.
   */
  services.loading.subscribe(() => {
    if (services.loading.getSnapshot().phase === 'idle') travel.finishLocationLoad()
  })
  travel.subscribe(() => quests.visitLocation(travel.getSnapshot().currentLocationId))
  quests.visitLocation(travel.getSnapshot().currentLocationId)
  let journey = travel.getSnapshot().journey
  let previousLocation = travel.getSnapshot().currentLocationId
  travel.subscribe(() => {
    const next = travel.getSnapshot().journey
    if (next > journey && previousLocation !== travel.getSnapshot().currentLocationId) statistics.record('trips', next - journey)

    previousLocation = travel.getSnapshot().currentLocationId
    journey = next
  })
  trackNotes(notes, travel, inventory, hasCharacter)

}
