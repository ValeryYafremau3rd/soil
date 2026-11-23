import { CONTENT } from '../../../content/catalogue'
import { DAYTIME_CONFIG } from '../../../content/daytime'
import { ITEMS } from '../../../content/items'
import { LOCATIONS } from '../../../content/locations'
import type { LockpickingConfig } from '../../../domain/buildings/lockpicking'
import type { QuestDefinition } from '../../../domain/quests/quests'
import { resolveFindItemRewards } from '../../../domain/quests/quests'
import type { Character } from '../../../domain/skills/character'
import { legendarySkill } from '../../../domain/skills/effects'
import { PerksService } from '../../services/character/PerksService'
import { StatisticsService } from '../../services/progression/StatisticsService'
import { LockpickingService } from '../../services/puzzles/LockpickingService'
import { QuestService } from '../../services/quests/QuestService'
import { LocationLoadingService } from '../../services/session/LocationLoadingService'
import { MessageService } from '../../services/ui/MessageService'
import { DayTimeService } from '../../services/world/DayTimeService'
import { RestService } from '../../services/world/RestService'
import { TravelService } from '../../services/world/TravelService'

import type { SaveGame } from '../../contracts/save'
import type { InventoryService } from '../../services/inventory/InventoryService'

/** Capabilities for quest, travel and lockpicking composition. */
interface AdventureSetup {
  inventory: InventoryService
  messages: MessageService
  daytime: DayTimeService
  perks: PerksService
  statistics: StatisticsService
  loading: LocationLoadingService
  rest: RestService
  currentCharacter: () => Character | null
  saved?: SaveGame
}

/**
 * Construct quest, travel and lockpicking stores and connect committed action events.
 * @param {AdventureSetup} setup - Inventory and character capabilities with saved arrival data.
 * @returns {object} Quest, travel and lockpicking service instances.
 */
export function createAdventureServices({
  inventory, messages, daytime, perks, statistics, loading, rest, currentCharacter, saved,
}: AdventureSetup) {
  const quests = new QuestService(
    resolveFindItemRewards(CONTENT.data.quests as QuestDefinition[], ITEMS,
      DAYTIME_CONFIG.findItemRewardMultipliers),
    inventory,
    messages.show,
    daytime,
    Math.random,
    questId => {
      perks.recordAction('questFinished')
      if (questId === 'well-trained') perks.recordAction('wellTrainedFinished')
    },
    () => currentCharacter()?.skills.persuasion ?? 0,
    () => currentCharacter()?.skills ?? {}
  )
  const travel = new TravelService(LOCATIONS, daytime, DAYTIME_CONFIG.travelsPerPhase, {
    amount: DAYTIME_CONFIG.busFare, pay: inventory.spendMoney,
    free: () => legendarySkill(currentCharacter()?.skills ?? {}, 'barter'),
  }, DAYTIME_CONFIG.nightDurationMultiplier, true)
  if (!saved) travel.restoreState({
    locationId: DAYTIME_CONFIG.initialLocationId,
    phaseTravels: DAYTIME_CONFIG.initialPhaseTravels
  })

  loading.begin(
    LOCATIONS.find(location => location.id === (saved?.travel.locationId ?? DAYTIME_CONFIG.initialLocationId))!.name,
    false
  )
  const lockpicking = new LockpickingService(
    daytime,
    () => currentCharacter()?.skills.lockpicking ?? 0,
    CONTENT.data.skills as LockpickingConfig,
    {
      has: () => inventory.getSnapshot().items.some(item => item.itemId === 'lockpick' && item.quantity > 0),
      canUse: () => inventory.canUseItem('lockpick'),
      consume: () => inventory.consumeItem('lockpick')
    },
    Date.now,
    Math.random,
    messages.show,
    inventory.hasDoorKey,
    () => perks.recordAction('lockPicked')
  )
  lockpicking.onLockType = kind => statistics.record(kind === 'container' ? 'containersLockpicked' : 'doorsLockpicked')
  inventory.onPurchased = itemId => quests.recordAction('buy', itemId)
  travel.onCompleted = mode => {
    if (mode === 'bus') quests.recordAction('bus')
  }
  rest.onCompleted = kind => {
    quests.recordAction(kind)
    statistics.record(kind === 'sleep' ? 'sleeps' : 'rests')
  }
  return { quests, travel, lockpicking }
}
