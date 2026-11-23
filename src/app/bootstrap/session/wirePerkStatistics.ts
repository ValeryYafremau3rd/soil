import { UI_CONFIG } from '../../../content/ui'
import type { QuestController } from '../../contracts/quests'
import type { StatisticsController } from '../../contracts/statistics'
import type { PerksService } from '../../services/character/PerksService'

/**
 * Record perk events and forward consumed items to the active quest service.
 * @param {Pick<PerksService, 'onAction' | 'onConsumed'>} perks - Event hook owner.
 * @param {StatisticsController} statistics - Session statistics recorder.
 * @param {() => QuestController} getQuests - Lazy reader for later-created quests.
 * @returns {void} Installs hooks before inventory and quest initialization.
 */
export function wirePerkStatistics(
  perks: Pick<PerksService, 'onAction' | 'onConsumed'>,
  statistics: StatisticsController,
  getQuests: () => QuestController,
): void {
  perks.onAction = action => {
    if (action === 'gunDefeat' || action === 'meleeDefeat') getQuests().recordAction(action)
    if (action === 'chaseHidden') {
      getQuests().recordAction('chaseHidden')
    }

    const counters = {
      lockPicked: 'locksPicked',
      itemSold: 'itemsSold',
      questFinished: 'questsCompleted',
      dialogueChosen: 'dialogueChoices',
      persuaded: 'persuaded',
      intimidated: 'intimidated',
      adviceAsked: 'adviceAsked',
      policeKilled: 'policeKilled'
    } as const
    if (action in counters) statistics.record(counters[action as keyof typeof counters])
  }
  perks.onConsumed = itemId => {
    getQuests().recordAction('consume', itemId)
    statistics.record('itemsConsumed')
    if (UI_CONFIG.perks.find(perk => perk.id === 'alcohol-addiction')?.itemIds.some(id => id === itemId)) statistics.record('alcoholDrunk')

    if (UI_CONFIG.perks.find(perk => perk.id === 'smoking-addiction')?.itemIds.some(id => id === itemId)) statistics.record('cigarettesSmoked')
  }
}
