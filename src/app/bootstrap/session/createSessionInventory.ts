import { CONTENT } from '../../../content/catalogue'
import { CONTAINER_PLACEMENTS, CONTAINER_SEEDS } from '../../../content/containers'
import { DIALOGUES } from '../../../content/dialogues'
import { ITEMS } from '../../../content/items'
import { LOCATIONS } from '../../../content/locations'
import type { NpcDefinition } from '../../../content/types'
import { isContainerObserved } from '../../../domain/inventory/looting'
import type { Character } from '../../../domain/skills/character'
import type { SkillEffects } from '../../../domain/skills/effects'
import { resolveNpcPlacements } from '../../content/resolveNpcPlacements'
import { buildVendorSeeds } from '../../content/vendorSeeds'
import { PerksService } from '../../services/character/PerksService'
import { StatusService } from '../../services/character/StatusService'
import { InventoryService } from '../../services/inventory/InventoryService'
import { LockpickingService } from '../../services/puzzles/LockpickingService'
import { QuestService } from '../../services/quests/QuestService'
import { MessageService } from '../../services/ui/MessageService'
import { DayTimeService } from '../../services/world/DayTimeService'

/** Explicit live capabilities needed to compose inventory actions. */
interface InventorySetup {
  isNpcAbsent: (npcId: string) => boolean
  daytime: DayTimeService
  status: StatusService
  perks: PerksService
  messages: MessageService
  skillEffects: () => SkillEffects
  currentCharacter: () => Character | null
  getQuests: () => QuestService
  getLockpicking: () => LockpickingService
}

/**
 * Construct inventory and enforce authored shipment, trader and witness restrictions.
 * @param {InventorySetup} setup - Live skills, status and deferred quest/lock capabilities.
 * @returns {InventoryService} The single inventory state owner.
 */
export function createSessionInventory({
  daytime, status, perks, messages, skillEffects, currentCharacter,
  getQuests, getLockpicking, isNpcAbsent,
}: InventorySetup): InventoryService {
  const merchantStock = buildVendorSeeds(DIALOGUES, ITEMS)
  const inventory = new InventoryService(
    ITEMS,
    [...CONTAINER_SEEDS, ...merchantStock],
    Math.random,
    [],
    status,
    skillEffects,
    (
      id,
      name,
      onUnlocked,
      rarity
    ) => getLockpicking().attemptContainer(id, name, onUnlocked, rarity),
    messages.show,
    () => currentCharacter()?.skills.erudition ?? 0,
    daytime.getSnapshot().phase === 'night',
    id => {
      const placement = CONTAINER_PLACEMENTS.find(container => container.id === id)
      const vendor = merchantStock.find(container => container.id === id)
      if (vendor?.requiresQuest && !getQuests().isCompleted(vendor.requiresQuest)) return 'Earn the trader\'s trust first.'

      if (placement?.nightOnly && daytime.getSnapshot().phase !== 'night') return 'Come back at night for this shipment.'

      if (placement?.questId && !getQuests().isActive(placement.questId)) return 'There is no shipment marked for you.'

      if (placement?.questIds && !placement.questIds.some(id => getQuests().isActive(id))) return 'There is no shipment marked for you.'

      return !placement || !isContainerObserved(
        placement,
        resolveNpcPlacements(CONTENT.data.npcs as Record<string, NpcDefinition>,
          LOCATIONS, placement.locationId, daytime.getSnapshot().phase)
          .filter(npc => !isNpcAbsent(npc.type))
      )
    },
    () => currentCharacter()?.skills.scraper ?? 0,
    () => currentCharacter()?.skills ?? {},
    () => perks.recordAction('itemSold'),
    () => perks.recordAction('itemScrapped'),
    (id, itemId) => getQuests().canTakeDeliveryItem(id, itemId)
  )
  return inventory
}
