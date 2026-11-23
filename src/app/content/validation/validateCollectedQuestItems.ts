import type { QuestStage } from '../../../domain/quests/quests'
import { hasQuestItems } from '../../../domain/quests/quests.ts'
import { requireCondition } from './assertions.ts'
import type { ContentContext } from './context.ts'

/**
 * Restrict historical collection credit to authored goods in a finite container.
 * @param {ContentContext} context - Assembled content used to resolve the loot source.
 * @param {QuestStage} stage - Objective that may accept earlier collection.
 * @param {string} path - Objective path used in content diagnostics.
 * @returns {void} Throws for missing sources or objectives that could consume historical goods.
 */
export function validateCollectedQuestItems(
  context: ContentContext,
  stage: QuestStage,
  path: string
): void {
  if (!stage.collectedFrom) return

  const source = context.containers.placements.find(container =>
    container.id === stage.collectedFrom)
  requireCondition(
    source?.restock === false && !source.lootTable
      && stage.trigger.kind === 'inventory' && stage.requiredItems?.length
      && !stage.removeItems?.length && !stage.requiredItemGroups?.length
      && hasQuestItems(source.items ?? [], stage.requiredItems),
    `${path}.collectedFrom: requires a finite source containing the required inventory goods`
  )
}
