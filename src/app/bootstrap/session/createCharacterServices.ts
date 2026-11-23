import { DAYTIME_CONFIG } from '../../../content/daytime'
import { difficultyRules } from '../../../content/difficulty'
import { ITEM_BY_ID } from '../../../content/items'
import { UI_CONFIG } from '../../../content/ui'
import { buffDamageResistance } from '../../../domain/character/perks'
import { resolveDamageResistance } from '../../../domain/inventory/items'
import type { Character } from '../../../domain/skills/character'
import type { SkillEffects } from '../../../domain/skills/effects'
import { itemBuffMultiplier, legendarySkill } from '../../../domain/skills/effects'
import type { SaveGame } from '../../contracts/save'
import type { VitalConfig } from '../../contracts/status'
import { PerksService } from '../../services/character/PerksService'
import { StatusService } from '../../services/character/StatusService'
import type { InventoryService } from '../../services/inventory/InventoryService'
import { StatisticsService } from '../../services/progression/StatisticsService'
import type { QuestService } from '../../services/quests/QuestService'
import { LocationLoadingService } from '../../services/session/LocationLoadingService'
import { MessageService } from '../../services/ui/MessageService'
import { DayTimeService } from '../../services/world/DayTimeService'
import { RestService } from '../../services/world/RestService'
import { wirePerkStatistics } from './wirePerkStatistics'

/** Explicit character and time dependencies needed before inventory initialization. */
interface CharacterSetup {
  difficulty: ReturnType<typeof difficultyRules>
  daytime: DayTimeService
  statistics: StatisticsService
  messages: MessageService
  saved?: SaveGame
  skillEffects: () => SkillEffects
  currentCharacter: () => Character | null
  getInventory: () => InventoryService
  getQuests: () => QuestService
  onWake: () => void
}

/**
 * Construct status, perks and rest stores using lazy reads for later-created services.
 * @param {CharacterSetup} setup - Character rules, clock and deferred inventory/quest readers.
 * @returns {object} Character stores, loading service and persistent sleep-debt state.
 */
export function createCharacterServices({
  difficulty, daytime, statistics, messages, saved, skillEffects,
  currentCharacter, getInventory, getQuests, onWake,
}: CharacterSetup) {
  const status = new StatusService(
    difficulty.stats as VitalConfig[],
    () => skillEffects().recovery,
    (): number => resolveDamageResistance(
      getInventory().getBonusItems(),
      ITEM_BY_ID,
      currentCharacter()?.skills ?? {},
      buffDamageResistance(
        perks.getSnapshot(),
        perks.buffDefinitions,
        itemBuffMultiplier(currentCharacter()?.skills ?? {})
      )
    )
  )
  const perks = new PerksService(
    UI_CONFIG.perks,
    daytime,
    status,
    saved?.perks,
    messages.show,
    UI_CONFIG.consumableBuffs,
    () => itemBuffMultiplier(currentCharacter()?.skills ?? {}),
    () => legendarySkill(currentCharacter()?.skills ?? {}, 'medicine')
  )
  wirePerkStatistics(perks, statistics, getQuests)
  status.setItemEffects(perks)
  const loading = new LocationLoadingService(UI_CONFIG.locationTransition.fadeMs)
  const rest = new RestService(daytime, status, difficulty.recovery, () => {
    perks.clearTimedEffects()
    onWake()
  }, loading)
  const sleepState = {
    ...DAYTIME_CONFIG.sleepDeprivation,
    awakePhases: saved?.awakePhases ?? 0,
    isSleeping: () => rest.isSleeping
  }
  return { status, perks, loading, rest, sleepState }
}
