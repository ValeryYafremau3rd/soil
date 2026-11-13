import { StatisticsService } from '../services/StatisticsService'
import { CONTENT } from '../../content/catalogue'
import { DIALOGUES } from '../../content/dialogues'
import { LOCATIONS } from '../../content/locations'
import type { GameServices } from '../contracts/game'
import { TravelService } from '../services/TravelService'
import { DialogueService } from '../services/DialogueService'
import { InventoryService } from '../services/InventoryService'
import { HudService } from '../services/HudService'
import { validateContent } from '../content/validateContent'
import { CONTAINER_PLACEMENTS, CONTAINER_SEEDS } from '../../content/containers'
import { resolveNpcPlacements } from '../content/resolveNpcPlacements'
import { buildVendorSeeds } from '../content/vendorSeeds'
import { isContainerObserved } from '../../domain/inventory/looting'
import type { NpcDefinition } from '../../content/types'
import { ITEM_BY_ID, ITEMS } from '../../content/items'
import { UI_CONFIG } from '../../content/ui'
import { DAYTIME_CONFIG } from '../../content/daytime'
import { DayTime } from '../services/DayTime'
import { RestService } from '../services/RestService'
import { CLASSES } from '../../content/classes'
import { createCharacter } from '../../domain/skills/character'
import type { Character } from '../../domain/skills/character'
import { coordinateWindows } from '../services/coordinateWindows'
import { StatusService } from '../services/StatusService'
import { resolveDamageResistance } from '../../domain/inventory/items'
import { resolveItemCharacter } from '../../domain/skills/condition'
import type { VitalConfig } from '../contracts/status'
import { refreshContainersEachMorning } from '../services/refreshContainersEachMorning'
import { drainStatusWithTime } from '../services/drainStatusWithTime'
import { difficultyRules, DIFFICULTIES } from '../../content/difficulty'
import { legendarySkill, itemBuffMultiplier, resolveSkillEffects } from '../../domain/skills/effects'
import type { SkillEffects, SkillEffectConfig } from '../../domain/skills/effects'
import { buffDamageResistance, buffVitals } from '../../domain/character/perks'
import { attributeVitals } from '../../domain/skills/vitals'

import { LockpickingService } from '../services/LockpickingService'
import type { LockpickingConfig } from '../../domain/buildings/lockpicking'
import { QuestService } from '../services/QuestService'
import type { QuestDefinition } from '../../domain/quests/quests'
import { resolveFindItemRewards } from '../../domain/quests/quests'
import { MessageService } from '../services/MessageService'
import { OptionsService } from '../services/OptionsService'
import { LocationLoadingService } from '../services/LocationLoadingService'
import { gameSaveStorage } from '../../platform/storage/gameSaveStorage'
import { closeGameTab } from '../../platform/closeGameTab'
import { validateSave } from '../persistence/validateSave'
import type { SaveReferences } from '../persistence/validateSave'
import type { SaveGame, SaveStorage } from '../contracts/save'
import { GAME_VERSION } from '../version'
import { BUILDINGS } from '../../content/buildings'
import { ROOMS } from '../../content/rooms'
import { PerksService } from '../services/PerksService'
import { NotesService, trackNotes } from '../services/NotesService'
import type { AdviceConfiguration } from '../../domain/dialogue/dialogue'

/** One validated content catalogue and one set of stores outlive scene restarts. */
export function createSession(classId?: string, difficultyId = DIFFICULTIES.defaultId,
  options: { saved?: SaveGame; storage?: SaveStorage; onLoad?: (save: SaveGame) => void; onRestart?: () => void } = {}): GameServices {
  validateContent(CONTENT.data, CONTENT.sources)
  const references: SaveReferences = { classIds: CLASSES.map(entry => entry.id), difficultyIds: DIFFICULTIES.presets.map(entry => entry.id),
    locations: LOCATIONS, items: ITEMS, quests: CONTENT.data.quests as QuestDefinition[], buildings: BUILDINGS, rooms: ROOMS,
    containerIds: [...CONTAINER_SEEDS.map(entry => entry.id), ...buildVendorSeeds(DIALOGUES, ITEMS).map(entry => entry.id)],
    optionalContainerIds: [...CONTAINER_SEEDS.filter(entry => entry.questId || entry.questIds?.length
      || entry.id.endsWith(':room-21-storage')).map(entry => entry.id), ...buildVendorSeeds(DIALOGUES, ITEMS).filter(entry => entry.requiresQuest || entry.id === 'merchant:citizen-nurse').map(entry => entry.id)],
    travelsPerPhase: DAYTIME_CONFIG.travelsPerPhase, npcIds: Object.keys(CONTENT.data.npcs as object) }
  const saved = options.saved ? validateSave(options.saved, references) : undefined
  const daytime = new DayTime(saved?.daytime.day ?? DAYTIME_CONFIG.initialDay, saved?.daytime.phase ?? DAYTIME_CONFIG.initialPhase, saved?.daytime.weather)
  const statistics = new StatisticsService(saved?.statistics)
  const messages = new MessageService()
  let difficulty = difficultyRules(saved?.difficultyId ?? difficultyId)
  let character: Character | null = null
  const definitions = Object.fromEntries(ITEMS.map(item => [item.id, item]))
  const notes = new NotesService({ locations: LOCATIONS.map(location => location.id), people: references.npcIds, items: ITEMS.map(item => item.id) })
  let characterCache: { inputs: readonly unknown[]; value: Character } | undefined
  const currentCharacter = (): Character | null => {
    if (!character) return null
    const inputs = [character, inventory.getSnapshot(), status.getSnapshot(), status.getLimits(), perks.getSnapshot()]
    if (characterCache && inputs.every((value, index) => value === characterCache!.inputs[index])) return characterCache.value
    const value = resolveItemCharacter(character, inventory.getBonusItems(), definitions, status.getSnapshot(), status.getLimits(), perks.getSnapshot(), perks.buffDefinitions, perks.definitions)
    characterCache = { inputs, value }
    return value
  }
  const skillEffects = (): SkillEffects => resolveSkillEffects(currentCharacter()?.skills ?? {}, CONTENT.data.skills as SkillEffectConfig)
  const status = new StatusService(difficulty.stats as VitalConfig[], () => skillEffects().recovery,
    (): number => resolveDamageResistance(inventory.getBonusItems(), ITEM_BY_ID, currentCharacter()?.skills ?? {},
      buffDamageResistance(perks.getSnapshot(), perks.buffDefinitions, itemBuffMultiplier(currentCharacter()?.skills ?? {}))))
  const perks = new PerksService(UI_CONFIG.perks, daytime, status, saved?.perks, messages.show, UI_CONFIG.consumableBuffs, () => itemBuffMultiplier(currentCharacter()?.skills ?? {}), () => legendarySkill(currentCharacter()?.skills ?? {}, 'medicine'))
  perks.onAction = action => {
    const counters = { lockPicked: 'locksPicked', itemSold: 'itemsSold', questFinished: 'questsCompleted',
      dialogueChosen: 'dialogueChoices', persuaded: 'persuaded', intimidated: 'intimidated', adviceAsked: 'adviceAsked', policeKilled: 'policeKilled' } as const
    if (action in counters) statistics.record(counters[action as keyof typeof counters])
  }
  perks.onConsumed = itemId => {
    statistics.record('itemsConsumed')
    if (UI_CONFIG.perks.find(perk => perk.id === 'alcohol-addiction')?.itemIds.some(id => id === itemId)) statistics.record('alcoholDrunk')
    if (UI_CONFIG.perks.find(perk => perk.id === 'smoking-addiction')?.itemIds.some(id => id === itemId)) statistics.record('cigarettesSmoked')
  }
  status.setItemEffects(perks)
  const loading = new LocationLoadingService(UI_CONFIG.locationTransition.fadeMs)
  const rest = new RestService(daytime, status, difficulty.recovery, () => { perks.clearTimedEffects(); services.options.save() }, loading)
  const sleepState = { ...DAYTIME_CONFIG.sleepDeprivation, awakePhases: saved?.awakePhases ?? 0, isSleeping: () => rest.isSleeping }
  const merchantStock = buildVendorSeeds(DIALOGUES, ITEMS)
  const inventory = new InventoryService(ITEMS, [...CONTAINER_SEEDS, ...merchantStock], Math.random, [], status, skillEffects,
    (id, name, onUnlocked, rarity) => services.lockpicking.attemptContainer(id, name, onUnlocked, rarity), messages.show,
    () => services.character?.skills.erudition ?? 0, daytime.getSnapshot().phase === 'night', id => {
      const placement = CONTAINER_PLACEMENTS.find(container => container.id === id)
      const vendor = merchantStock.find(container => container.id === id)
      if (vendor?.requiresQuest && !services.quests.isCompleted(vendor.requiresQuest)) return 'Earn the trader\'s trust first.'
      if (placement?.nightOnly && daytime.getSnapshot().phase !== 'night') return 'Come back at night for this shipment.'
      if (placement?.questId && !services.quests.isActive(placement.questId)) return 'There is no shipment marked for you.'
      if (placement?.questIds && !placement.questIds.some(id => services.quests.isActive(id))) return 'There is no shipment marked for you.'
      return !placement || !isContainerObserved(placement, resolveNpcPlacements(CONTENT.data.npcs as Record<string, NpcDefinition>,
        LOCATIONS, placement.locationId, daytime.getSnapshot().phase))
    }, () => services.character?.skills.scraper ?? 0, () => services.character?.skills ?? {}, () => perks.recordAction('itemSold'), () => perks.recordAction('itemScrapped'), (id, itemId) => services.quests.canTakeDeliveryItem(id, itemId))
  inventory.subscribeLoot(pickup => {
    for (const stack of pickup.items) for (let unit = 0; unit < stack.quantity; unit++) perks.recordAction('itemLooted')
  })
  let trackingStatistics = false
  inventory.onStatistic = (id, amount) => { if (trackingStatistics) statistics.record(id, amount) }
  inventory.subscribeLoot(pickup => {
    for (const stack of pickup.items) {
      statistics.record('itemsLooted', stack.quantity)
      if (stack.itemId === 'money') statistics.record('moneyEarned', stack.quantity)
    }
  })
  const quests = new QuestService(resolveFindItemRewards(CONTENT.data.quests as QuestDefinition[], ITEMS,
    DAYTIME_CONFIG.findItemRewardMultipliers), inventory, messages.show, daytime, Math.random, () => perks.recordAction('questFinished'),
    () => currentCharacter()?.skills.persuasion ?? 0)
  const travel = new TravelService(LOCATIONS, daytime, DAYTIME_CONFIG.travelsPerPhase, {
    amount: DAYTIME_CONFIG.busFare, pay: inventory.spendMoney,
    free: () => legendarySkill(currentCharacter()?.skills ?? {}, 'barter'),
  })
  if (!saved) travel.restoreState({ locationId: DAYTIME_CONFIG.initialLocationId, phaseTravels: DAYTIME_CONFIG.initialPhaseTravels })
  loading.begin(LOCATIONS.find(location => location.id === (saved?.travel.locationId ?? DAYTIME_CONFIG.initialLocationId))!.name, false)
  const lockpicking = new LockpickingService(daytime, () => services.character?.skills.lockpicking ?? 0, CONTENT.data.skills as LockpickingConfig,
    { has: () => inventory.getSnapshot().items.some(item => item.itemId === 'lockpick' && item.quantity > 0),
      canUse: () => inventory.canUseItem('lockpick'), consume: () => inventory.consumeItem('lockpick') }, Date.now, Math.random, messages.show, inventory.hasDoorKey, () => perks.recordAction('lockPicked'))
  lockpicking.onLockType = kind => statistics.record(kind === 'container' ? 'containersLockpicked' : 'doorsLockpicked')
  rest.onCompleted = kind => statistics.record(kind === 'sleep' ? 'sleeps' : 'rests')
  const dialogue = new DialogueService(inventory.openContainer, {
    isRepeatable: questId => Boolean(quests.definitions.find(quest => quest.id === questId)?.repeatable),
    getTrust: quests.getTrust,
    describeQuest: questId => { const quest = quests.definitions.find(quest => quest.id === questId); return quest?.destinations ? quest.description : undefined },
    canChoose: (npcId, choice) => quests.canAdvanceDialogue(choice.questId!, npcId, choice.id),
    choose: (npcId, choice) => quests.advanceDialogue(choice.questId!, npcId, choice.id),
    canOffer: quests.canOffer, acceptFromNpc: quests.acceptFromNpc, isCompleted: quests.isCompleted,
  }, notes.meetPerson, choice => {
    perks.recordAction('dialogueChosen')
    if (choice.approach) perks.recordAction(choice.approach === 'persuasion' ? 'persuaded' : 'intimidated')
  }, { skill: () => currentCharacter()?.skills.intimidation ?? 0, day: () => daytime.getSnapshot().day,
    pay: amount => inventory.tryExchangeItems([], [], amount), notify: messages.show, saved: saved?.intimidatedDays },
  { config: CONTENT.data.advice as AdviceConfiguration, skill: () => currentCharacter()?.skills.persuasion ?? 0,
    day: () => daytime.getSnapshot().day, onAsked: () => perks.recordAction('adviceAsked'), saved: saved?.adviceDays })
  const services: GameServices = {
    statistics,
    perks,
    notes,
    loading,
    messages,
    options: new OptionsService(options.storage ?? gameSaveStorage, position => {
      if (!character || status.getSnapshot().health <= 0 || position.locationId !== travel.getSnapshot().currentLocationId) return null
      return { version: 1, gameVersion: GAME_VERSION, openingVersion: 1, savedAt: new Date().toISOString(), classId: character.classId, difficultyId: difficulty.id,
        daytime: daytime.getSnapshot(), status: status.getSnapshot(), inventory: inventory.saveState(), quests: quests.getSnapshot().progress,
        courierBoard: quests.getSnapshot().courierBoard,
        npcJobs: quests.getSnapshot().npcJobs,
        statistics: statistics.getSnapshot(), perks: perks.getSnapshot(), notes: notes.getSnapshot(), awakePhases: sleepState.awakePhases, intimidatedDays: dialogue.saveState(),
        adviceDays: dialogue.saveAdviceState(),
        travel: travel.saveState(), unlockedDoors: lockpicking.saveState(), position }
    }, value => validateSave(value, references), options.onLoad ?? (() => {}), options.onRestart ?? (() => {}), messages.show, saved?.position,
    () => closeGameTab(() => messages.show('Your browser blocked closing this tab. Close the tab to exit the game.'))),
    quests,
    get skillEffects() { return skillEffects() },
    get character() { return currentCharacter() },
    get difficulty() { return difficulty },
    lockpicking,
    status,
    chooseClass(id, selectedDifficulty = difficultyId) {
      if (character) return
      const definition = CLASSES.find(entry => entry.id === id)
      if (!definition) throw new Error(`Unknown class: ${id}`)
      difficulty = difficultyRules(selectedDifficulty)
      rest.configure(difficulty.recovery)
      drainStatusWithTime(daytime, status, difficulty.timeCosts, () => rest.isAdvancingTime, sleepState)
      character = createCharacter(definition)
      const wasTracking = trackingStatistics
      trackingStatistics = false
      try {
        inventory.grantItems(definition.startingItems.map(itemId => ({ itemId, quantity: definition.startingItemQuantities?.[itemId] ?? 1 })))
      } finally { trackingStatistics = wasTracking }
      const equipped = resolveItemCharacter(character, inventory.getBonusItems(), definitions, status.getSnapshot(), status.getLimits(), perks.getSnapshot(), perks.buffDefinitions, perks.definitions, false)
      status.configure(buffVitals(attributeVitals(difficulty.stats as VitalConfig[], equipped.attributes), perks.getSnapshot(), perks.buffDefinitions), difficulty.modifiers.itemRecovery)
      if (!saved) dialogue.openInvestigation(DIALOGUES.awakening)
    },
    rest,
    daytime, travel, dialogue,
    inventory,
    hud: new HudService(UI_CONFIG.menus.filter(menu => menu.id !== 'inventory').map(menu => menu.id)),
  }
  let updatingLimits = false
  const updateVitalLimits = (): void => {
    if (!character || updatingLimits) return
    updatingLimits = true
    try {
      const skills = currentCharacter()!.skills
      const effective = resolveItemCharacter(character, inventory.getBonusItems(), definitions, status.getSnapshot(), status.getLimits(), perks.getSnapshot(), perks.buffDefinitions, perks.definitions, false, skills)
      status.setLimits(buffVitals(attributeVitals(difficulty.stats as VitalConfig[], effective.attributes), perks.getSnapshot(), perks.buffDefinitions, itemBuffMultiplier(skills)))
      inventory.syncLegendaryStock()
    } finally { updatingLimits = false }
  }
  status.subscribe(updateVitalLimits)
  inventory.subscribe(updateVitalLimits)
  perks.subscribe(updateVitalLimits)
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
  trackingStatistics = true
  quests.startInitialQuests()
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
  trackNotes(notes, travel, inventory, () => character !== null)
  return services
}

