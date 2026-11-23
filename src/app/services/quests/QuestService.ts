import type { ItemStack } from '../../../domain/inventory/loot'
import type { QuestAction, CourierBoard, QuestDefinition, QuestStage, QuestProgress, QuestParameters } from '../../../domain/quests/quests'
import type { Character } from '../../../domain/skills/character'
import { resolveQuestMoney } from '../../../domain/quests/quests.ts'
import {
  activeQuestStages,
  availableBoardQuests,
  canCompleteStage,
  hasQuestItems,
  isQuestAvailable,
  isQuestCompleted,
  npcTrust,
  selectQuestGroupItems,
  resolveQuest,
  resolveFindItemRewards
} from '../../../domain/quests/quests.ts'
import type { DayTimeController } from '../../contracts/daytime'
import { DAYTIME_CONFIG } from '../../../content/daytime.ts'
import type { QuestController, QuestSnapshot } from '../../contracts/quests'
import type { InventoryController } from '../../contracts/inventory'
import { ObservableStore } from '../core/ObservableStore.ts'
import { DAY_PHASES } from '../../contracts/daytime.ts'
import { planEscape } from '../../../domain/quests/escape.ts'
import { recognizeEscapeKey } from '../../../domain/quests/escapeClues.ts'

/**
 * Owns quest service state and behavior.
 */
export class QuestService extends ObservableStore<QuestSnapshot> implements QuestController {
  private readonly templates: readonly QuestDefinition[]

  /**
   * Perform definitions for QuestService.
   * @returns {readonly QuestDefinition[]} The result described by the TypeScript return signature.
   */
  get definitions(): readonly QuestDefinition[] {
    return this.templates.map(quest => this.resolve(
      quest,
      this.snapshot.progress.find(entry => entry.questId === quest.id)?.parameters
      ?? this.snapshot.courierBoard.parameters?.[quest.id] ?? this.snapshot.npcJobs.parameters?.[quest.id]
    ))
      .map(quest => resolveQuestMoney(quest, this.rewardSkills()))
  }

  /**
   * Perform resolve for QuestService.
   * @param {QuestDefinition} quest - The quest supplied to this operation.
   * @param {QuestParameters | undefined} parameters - The parameters supplied to this operation.
   * @returns {QuestDefinition} The result described by the TypeScript return signature.
   */
  private resolve(
    quest: QuestDefinition,
    parameters?: QuestParameters
  ): QuestDefinition {
    const resolved = resolveQuest(quest, parameters)

    return resolved.findItem && resolved.findItem !== '$item' && quest.findItemOptions
      ? resolveFindItemRewards(
        [resolved],
        quest.findItemOptions,
        DAYTIME_CONFIG.findItemRewardMultipliers
      )[0] : resolved
  }

  /**
   * Perform offered definition for QuestService.
   * @param {string} id - The id supplied to this operation.
   * @returns {QuestDefinition | undefined} The result described by the TypeScript return signature.
   */
  private offeredDefinition(id: string): QuestDefinition | undefined {
    const quest = this.templates.find(quest => quest.id === id)

    return quest && this.resolve(
      quest,
      this.snapshot.courierBoard.parameters?.[id] ?? this.snapshot.npcJobs.parameters?.[id]
    )
  }

  /**
   * Read board quests.
   * @returns {readonly QuestDefinition[]} The result described by the TypeScript return signature.
   */
  getBoardQuests = (): readonly QuestDefinition[] => availableBoardQuests(this.templates.map(quest => this.offeredDefinition(quest.id)!),
    this.snapshot.progress, this.snapshot.courierBoard, DAYTIME_CONFIG.findItemMaxPrice)
    .map(quest => resolveQuestMoney(quest, this.rewardSkills()))

  /**
   * Perform roll parameters for QuestService.
   * @param {QuestDefinition} quest - The quest supplied to this operation.
   * @returns {QuestParameters | undefined} The result described by the TypeScript return signature.
   */
  private rollParameters(quest: QuestDefinition): QuestParameters | undefined {
    const destinations = quest.destinations
    if (!destinations || destinations.length < 2) return undefined

    const source = destinations[Math.min(destinations.length - 1, Math.floor(this.random() * destinations.length))]
    const rest = destinations.filter(destination => destination.id !== source.id)
    const destination = rest[Math.min(rest.length - 1, Math.floor(this.random() * rest.length))]
    if (!quest.findItemOptions) return { sourceId: source.id, destinationId: destination.id }

    const candidates = quest.findItemOptions.filter(item => (item.price ?? Infinity) <= DAYTIME_CONFIG.findItemMaxPrice)
    const item = candidates[Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length))]

    return item ? { sourceId: source.id, destinationId: destination.id, itemId: item.id } : undefined
  }
  private readonly inventory: Pick<InventoryController, 'getSnapshot' | 'subscribe' | 'removeItems' | 'tryExchangeItems'> & Partial<Pick<InventoryController, 'prepareQuestItem' | 'discardItemsEverywhere'>>
  private readonly notify: (text: string) => void
  private readonly onFinished: (questId: string) => void
  private advancing = false
  private readonly day: () => number
  private readonly random: () => number
  private readonly phase: () => string
  private readonly clock: () => number
  private readonly persuasion: () => number
  private readonly rewardSkills: () => Partial<Character['skills']>

  /**
   * Initialize the QuestService instance and its collaborators.
   * @param {readonly QuestDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
   * @param {object} inventory - Inventory capability used to read or transact items.
   * @param {(text: string) => void} notify - Callback for presenting an operation message.
   * @param {Pick<DayTimeController, "getSnapshot" | "subscribe"> | undefined} daytime - The daytime supplied to this operation.
   * @param {() => number} random - Random-number source; injectable for deterministic results.
   * @param {(questId: string) => void} onFinished - The on finished supplied to this operation.
   * @param {() => number} persuasion - The persuasion supplied to this operation.
   * @param {() => Partial<Skills>} rewardSkills - The reward skills supplied to this operation.
   * @returns {QuestService} The initialized instance.
   */
  constructor(
    definitions: readonly QuestDefinition[],
    inventory: Pick<InventoryController, 'getSnapshot' | 'subscribe' | 'removeItems' | 'tryExchangeItems'> & Partial<Pick<InventoryController, 'subscribeLoot' | 'subscribeDeposit' | 'prepareQuestItem' | 'discardItemsEverywhere'>>,
    notify: (text: string) => void = () => { },
    daytime?: Pick<DayTimeController, 'getSnapshot' | 'subscribe'>,
    random: () => number = Math.random,
    onFinished: (questId: string) => void = () => { },
    persuasion: () => number = () => 0,
    rewardSkills: () => Partial<Character['skills']> = () => ({})
  ) {
    super({
      boardOpen: false,
      progress: [],
      courierBoard: { day: daytime?.getSnapshot().day ?? 1, offeredQuestIds: [], acceptedQuestIds: [] },
      npcJobs: { day: daytime?.getSnapshot().day ?? 1, offeredQuestIds: [], acceptedQuestIds: [] }
    })
    this.templates = definitions
    this.inventory = inventory
    this.notify = notify
    this.day = () => daytime?.getSnapshot().day ?? 1
    this.phase = () => daytime?.getSnapshot().phase ?? 'morning'
    this.clock = () => (this.day() - 1) * 4 + DAY_PHASES.indexOf(daytime?.getSnapshot().phase ?? 'morning')
    this.random = random
    this.onFinished = onFinished
    this.persuasion = persuasion
    this.rewardSkills = rewardSkills
    this.snapshot = { ...this.snapshot, courierBoard: this.rollCourierBoard(), npcJobs: this.rollNpcJobs() }
    daytime?.subscribe(() => {
      this.expire()
      if (this.snapshot.courierBoard.day !== this.day()) {
        this.publish({
          ...this.snapshot,
          courierBoard: this.rollCourierBoard(),
          npcJobs: this.rollNpcJobs()
        })
        this.startMorningQuests()
      }
    })
    inventory.subscribe(this.checkInventory)
    inventory.subscribeDeposit?.(deposit => {
      if (this.advancing) return

      for (const progress of this.snapshot.progress) for (const stage of this.stages(progress.questId)) {
        if (stage.trigger.kind === 'deposit' && stage.trigger.containerId === deposit.containerId && hasQuestItems(deposit.items, stage.requiredItems)) {
          if (this.complete(progress.questId, stage, deposit.items)) this.checkInventory()
        }
      }
    })
    inventory.subscribeLoot?.(pickup => {
      if (this.advancing) return

      this.acceptMorningPickup(pickup.containerId, pickup.items)
      for (const progress of this.snapshot.progress) {
        for (const stage of this.stages(progress.questId)) {
          const trigger = stage.trigger
          if (trigger.kind === 'loot' && trigger.containerId === pickup.containerId && hasQuestItems(pickup.items, stage.requiredItems)
            && this.complete(progress.questId, stage)) this.checkInventory()
        }
      }
    })
  }

  /**
   * Check whether take delivery item is allowed.
   * @param {string} containerId - The container id supplied to this operation.
   * @param {string} itemId - Identifier of the item being processed.
   * @returns {string | boolean} The result described by the TypeScript return signature.
   */
  canTakeDeliveryItem = (
    containerId: string,
    itemId: string
  ): boolean | string => {
    const timedPickup = this.definitions.filter(quest => this.isActive(quest.id)).flatMap(quest => this.stages(quest.id)).find(stage =>
      stage.trigger.kind === 'loot' && stage.trigger.containerId === containerId && stage.requiredItems?.some(item => item.itemId === itemId)
      && stage.phases && !stage.phases.includes(this.phase()))
    if (timedPickup) return 'Come back during the pickup phase named in your quest.'

    const jobs = this.definitions.filter(quest => quest.deliveryItemId === itemId)
    if (!jobs.length) return true

    const quest = jobs.find(quest => this.isActive(quest.id))
    if (!quest) {
      const pending = jobs.find(job => job.morningStart
        && this.snapshot.courierBoard.offeredQuestIds.includes(job.id)
        && !this.snapshot.courierBoard.acceptedQuestIds.includes(job.id))
      const pickup = pending?.stages[0].trigger

      return pickup?.kind === 'loot' && pickup.containerId === containerId
        ? true : 'There is no active job for this parcel.'
    }

    const stages = this.stages(quest.id)
    const collection = stages.find(stage => stage.trigger.kind === 'loot')
    if (collection) {
      if (collection.trigger.kind !== 'loot' || collection.trigger.containerId !== containerId) return 'Collect this parcel from the crate named in your quest.'

      if (collection.phases && !collection.phases.includes(this.phase())) return 'Come back at night for this shipment.'
    } else if (!stages.some(stage => stage.requiredItems?.some(item => item.itemId === itemId))) return 'This parcel is no longer needed.'

    return true
  }

  /**
   * Prepare delivery.
   * @param {QuestDefinition} definition - The definition supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private prepareDelivery(definition: QuestDefinition): void {
    const stage = this.stages(definition.id).find(stage => stage.trigger.kind === 'loot')
    if (stage?.trigger.kind !== 'loot'
      || !definition.deliveryKind && !definition.deliveryItemId) return

    this.advancing = true
    try {
      if (definition.deliveryItemId) this.inventory.prepareQuestItem?.(stage.trigger.containerId, definition.deliveryItemId)
      else for (const item of stage.requiredItems ?? []) this.inventory.prepareQuestItem?.(stage.trigger.containerId, item.itemId, false)
    }
    finally {
      this.advancing = false
    }
  }

  /**
   * Perform start initial quests for QuestService.
   * @returns {void} Completes the operation without returning a value.
   */
  startInitialQuests = (): void => {
    this.startMorningQuests()
    for (const definition of this.definitions) {
      if (definition.autoStart && !this.snapshot.progress.some(entry => entry.questId === definition.id)) this.acceptDefinition(definition)
    }
  }

  /**
   * Prepare daily letters without starting their quests before pickup.
   * @returns {void} Publishes the route and prepares its letter in the postbox.
   */
  private startMorningQuests(): void {
    for (const quest of this.templates.filter(quest => quest.morningStart)) {
      const pickup = quest.stages[0].trigger
      if (pickup.kind !== 'loot'
        || !this.inventory.getSnapshot().containers[pickup.containerId]) continue

      const board = this.snapshot.courierBoard
      if (board.acceptedQuestIds.includes(quest.id)) continue

      const active = this.isActive(quest.id)
      const offered = board.offeredQuestIds.includes(quest.id)
      const parameters = active
        ? this.snapshot.progress.find(entry => entry.questId === quest.id)?.parameters
        : board.parameters?.[quest.id] ?? this.rollParameters(quest)
      this.snapshot = { ...this.snapshot, courierBoard: {
        ...board,
        offeredQuestIds: [...new Set([...board.offeredQuestIds, quest.id])],
        acceptedQuestIds: active ? [...board.acceptedQuestIds, quest.id] : board.acceptedQuestIds,
        parameters: { ...board.parameters, ...(parameters ? { [quest.id]: parameters } : {}) }
      } }
      this.publish(this.snapshot)
      if (!active && !offered && quest.deliveryItemId) {
        this.inventory.prepareQuestItem?.(pickup.containerId, quest.deliveryItemId)
      }
    }
  }

  /**
   * Start a waiting letter quest only after its inventory transfer succeeds.
   * @param {string} containerId - Container that supplied the collected items.
   * @param {readonly ItemStack[]} items - Items transferred by this pickup.
   * @returns {void} Creates progress before the pickup stage is completed.
   */
  private acceptMorningPickup(containerId: string, items: readonly ItemStack[]): void {
    const board = this.snapshot.courierBoard
    for (const quest of this.templates.filter(quest => quest.morningStart)) {
      const pickup = quest.stages[0]
      if (pickup.trigger.kind !== 'loot' || pickup.trigger.containerId !== containerId
        || !hasQuestItems(items, pickup.requiredItems) || this.isActive(quest.id)
        || !board.offeredQuestIds.includes(quest.id)
        || board.acceptedQuestIds.includes(quest.id)) continue

      this.acceptDefinition(this.offeredDefinition(quest.id)!)
    }
  }

  /**
   * Open board.
   * @returns {void} Completes the operation without returning a value.
   */
  openBoard = (): void => {
    if (!this.snapshot.boardOpen) this.publish({ ...this.snapshot, boardOpen: true })
  }

  /**
   * Restore state.
   * @param {readonly QuestProgress[]} progress - The progress supplied to this operation.
   * @param {CourierBoard | undefined} courierBoard - The courier board supplied to this operation.
   * @param {CourierBoard | undefined} npcJobs - The npc jobs supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  restoreState = (
    progress: readonly QuestProgress[],
    courierBoard?: CourierBoard,
    npcJobs?: CourierBoard
  ): void => {
    this.snapshot = { ...this.snapshot, progress: structuredClone(progress) }
    const board = courierBoard?.day === this.day() ? structuredClone(courierBoard) : this.rollCourierBoard()
    // Older saves have no daily ledger: do not allow already-recorded courier jobs to repeat today.
    if (!courierBoard) board.acceptedQuestIds = board.offeredQuestIds.filter(id => progress.some(entry => entry.questId === id))

    const jobs = npcJobs?.day === this.day() ? structuredClone(npcJobs) : this.rollNpcJobs()
    // Without a saved NPC ledger, completed/active radiant runs cannot earn another acceptance today.
    if (!npcJobs) {
      const runs = progress.filter(entry => this.definitions.some(quest => quest.id === entry.questId && quest.repeatable && quest.offeredBy))
      const latest = new Map(runs.map(entry => [this.definitions.find(quest => quest.id === entry.questId)!.offeredBy, entry.questId]))
      jobs.acceptedQuestIds = [...latest.values()]
      jobs.offeredQuestIds = [
        ...jobs.offeredQuestIds.filter(id => !latest.has(this.definitions.find(quest => quest.id === id)!.offeredBy)),
        ...latest.values()
      ]
    }

    this.publish({
      ...this.snapshot,
      boardOpen: false,
      courierBoard: board,
      npcJobs: this.rollNpcJobs(jobs)
    })
    this.restoreWaitingLetters()
    this.expire()
    this.advancing = true
    try {
      for (const entry of this.snapshot.progress.filter(entry => entry.failed)) {
        const itemId = this.definitions.find(quest => quest.id === entry.questId)?.deliveryItemId
        if (itemId && !this.definitions.some(quest => quest.deliveryItemId === itemId && this.isActive(quest.id))) this.inventory.discardItemsEverywhere?.([itemId])
      }
    } finally {
      this.advancing = false
    }

    for (const definition of this.definitions.filter(quest => this.isActive(quest.id))) this.prepareDelivery(definition)

    this.checkInventory()
  }

  /**
   * Hide legacy postbox objectives that were saved before collecting their letters.
   * @returns {void} Converts uncollected progress into a pending daily offer.
   */
  private restoreWaitingLetters(): void {
    const waiting = this.snapshot.progress.filter(entry => entry.stageIndex === 0
      && this.templates.some(quest => quest.id === entry.questId && quest.morningStart))
    if (!waiting.length) return

    const ids = waiting.map(entry => entry.questId)
    const board = this.snapshot.courierBoard
    this.publish({ ...this.snapshot,
      progress: this.snapshot.progress.filter(entry => !ids.includes(entry.questId)),
      courierBoard: { ...board,
        offeredQuestIds: [...new Set([...board.offeredQuestIds, ...ids])],
        acceptedQuestIds: board.acceptedQuestIds.filter(id => !ids.includes(id)),
        parameters: { ...board.parameters, ...Object.fromEntries(waiting.flatMap(entry =>
          entry.parameters ? [[entry.questId, entry.parameters]] : [])) }
      }
    })
  }

  /**
   * Perform roll npc jobs for QuestService.
   * @param {CourierBoard | undefined} existing - The existing supplied to this operation.
   * @returns {CourierBoard} The result described by the TypeScript return signature.
   */
  private rollNpcJobs(existing?: CourierBoard): CourierBoard {
    const board: CourierBoard = existing ? { ...existing, offeredQuestIds: [...existing.offeredQuestIds] }
      : { day: this.day(), offeredQuestIds: [], acceptedQuestIds: [] }
    const pool = this.definitions.filter(quest => quest.repeatable && quest.offeredBy
      && !quest.prerequisites?.some(id => !this.isCompleted(id)))
    const parameters = { ...board.parameters }
    const offered = [...board.offeredQuestIds]

    for (const npc of new Set(pool.map(quest => quest.offeredBy))) {
      if ([...offered, ...board.acceptedQuestIds].some(id => this.definitions.find(quest => quest.id === id)?.offeredBy === npc)
        || this.definitions.some(quest => quest.repeatable && quest.offeredBy === npc && this.isActive(quest.id))) continue

      const candidates = pool.filter(quest => quest.offeredBy === npc)
      const quest = candidates[Math.floor(this.random() * candidates.length)]
      offered.push(quest.id)
      const values = this.rollParameters(quest)
      if (values) parameters[quest.id] = values
    }

    return {
      ...board,
      offeredQuestIds: offered,
      ...(Object.keys(parameters).length ? { parameters } : {})
    }
  }

  /**
   * Perform roll courier board for QuestService.
   * @returns {CourierBoard} The result described by the TypeScript return signature.
   */
  private rollCourierBoard(): CourierBoard {
    const pool = this.definitions.filter(quest => quest.repeatable && !quest.morningStart && !quest.findItem && !quest.offeredBy && !quest.prerequisites?.some(id => !this.isCompleted(id)) && !this.isActive(quest.id))
    const { min, max } = DAYTIME_CONFIG.courierJobsPerDay
    const count = Math.min(pool.length, min + Math.floor(this.random() * (max - min + 1)))
    const offeredQuestIds: string[] = []
    while (offeredQuestIds.length < count) offeredQuestIds.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0].id)
    const request = this.templates.find(quest => quest.findItem && quest.repeatable && !this.isActive(quest.id))
    if (request?.findItemOptions?.some(item => (item.price ?? Infinity) <= DAYTIME_CONFIG.findItemMaxPrice)) offeredQuestIds.push(request.id)

    const pending = this.templates.filter(quest => quest.morningStart
      && this.snapshot.courierBoard.offeredQuestIds.includes(quest.id)
      && !this.snapshot.courierBoard.acceptedQuestIds.includes(quest.id))
    offeredQuestIds.push(...pending.map(quest => quest.id))
    const parameters = Object.fromEntries(offeredQuestIds.flatMap(id => {
      const quest = this.templates.find(quest => quest.id === id)!
      const values = quest.morningStart
        ? this.snapshot.courierBoard.parameters?.[id] : this.rollParameters(quest)

      return values ? [[id, values]] : []
    }))

    return {
      day: this.day(),
      offeredQuestIds,
      acceptedQuestIds: [],
      ...(Object.keys(parameters).length ? { parameters } : {})
    }
  }

  /**
   * Close board.
   * @returns {void} Completes the operation without returning a value.
   */
  closeBoard = (): void => {
    if (this.snapshot.boardOpen) this.publish({ ...this.snapshot, boardOpen: false })
  }

  /**
   * Check whether completed is true.
   * @param {string} questId - The quest id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  isCompleted = (questId: string): boolean => isQuestCompleted(questId, this.snapshot.progress, this.definitions)

  /**
   * Read trust.
   * @param {string} npcId - The npc id supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  getTrust = (npcId: string): number => npcTrust(npcId, this.snapshot.progress, this.definitions, this.persuasion())

  /**
   * Check whether active is true.
   * @param {string} questId - The quest id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  isActive = (questId: string): boolean => this.snapshot.progress.some(entry => entry.questId === questId && !entry.failed && !this.isCompleted(questId))

  /**
   * Check whether offer is allowed.
   * @param {string} questId - The quest id supplied to this operation.
   * @param {string} npcId - The npc id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canOffer = (
    questId: string,
    npcId: string
  ): boolean => {
    const definition = this.definitions.find(quest => quest.id === questId)
    if (!definition || definition.offeredBy !== npcId) return false

    if (definition.repeatable && (this.snapshot.npcJobs.acceptedQuestIds.some(id => this.definitions.find(quest => quest.id === id)?.offeredBy === npcId)
      || this.definitions.some(quest => quest.repeatable && quest.offeredBy === npcId && this.isActive(quest.id)))) return false

    return isQuestAvailable(
      definition,
      this.snapshot.progress,
      definition.repeatable ? this.snapshot.npcJobs : this.snapshot.courierBoard,
      this.definitions
    )
  }

  /**
   * Read offer.
   * @param {string} npcId - The npc id supplied to this operation.
   * @returns {string | null} The result described by the TypeScript return signature.
   */
  getOffer = (npcId: string): string | null => {
    const quest = this.definitions.find(quest => this.canOffer(quest.id, npcId))

    return quest ? this.offeredDefinition(quest.id)?.offerText ?? 'Come closer. I have a job for you.' : null
  }

  /**
   * Perform accept from npc for QuestService.
   * @param {string} questId - The quest id supplied to this operation.
   * @param {string} npcId - The npc id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  acceptFromNpc = (questId: string, npcId: string): boolean => {
    if (!this.canOffer(questId, npcId)) return false

    return this.acceptDefinition(this.offeredDefinition(questId)!)
  }

  /**
   * Perform accept for QuestService.
   * @param {string} questId - The quest id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  accept = (questId: string): void => {
    const definition = this.getBoardQuests().find(quest => quest.id === questId)
    if (!this.snapshot.boardOpen || !definition) return

    this.acceptDefinition(definition)
  }

  /**
   * Bypass offer gates; keep active runs intact and roll valid radiant parameters.
   * @param {string} questId - The quest id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  startForTesting = (questId: string): boolean => {
    const template = this.templates.find(quest => quest.id === questId)
    if (!template || this.advancing || this.isActive(questId)) return false

    const parameters = this.rollParameters(template)
    if (parameters) {
      const key = template.offeredBy ? 'npcJobs' : 'courierBoard'
      this.publish({
        ...this.snapshot,
        [key]: {
          ...this.snapshot[key],
          parameters: { ...this.snapshot[key].parameters, [questId]: parameters }
        }
      })
    }

    return this.acceptDefinition(this.offeredDefinition(questId)!, true)
  }

  /**
   * Perform accept definition for QuestService.
   * @param {QuestDefinition} definition - The definition supplied to this operation.
   * @param {boolean} testing - The testing supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private acceptDefinition(
    definition: QuestDefinition,
    testing = false
  ): boolean {
    const questId = definition.id
    if (!testing && definition.deliveryKind && this.definitions.some(other => other.id !== questId && other.deliveryKind === definition.deliveryKind && this.isActive(other.id))) return false

    const first = definition.stages[0]
    const automatic = first.trigger.kind === 'accept'
    this.advancing = true
    try {
      // Testing starts never require payment or space, but grant starter supplies when possible.
      if (automatic && !this.inventory.tryExchangeItems(
        testing ? [] : first.removeItems ?? [],
        first.grantItems ?? []
      ) && !testing) return false
    } finally {
      this.advancing = false
    }
    const courierBoard = definition.repeatable && !definition.offeredBy ? {
      ...this.snapshot.courierBoard,
      acceptedQuestIds: [...this.snapshot.courierBoard.acceptedQuestIds, questId]
    } : this.snapshot.courierBoard
    const npcJobs = definition.repeatable && definition.offeredBy ? {
      ...this.snapshot.npcJobs,
      acceptedQuestIds: [...this.snapshot.npcJobs.acceptedQuestIds, questId]
    } : this.snapshot.npcJobs
    this.publish({
      boardOpen: false,
      courierBoard,
      npcJobs,
      progress: [
        ...this.snapshot.progress.filter(quest => quest.questId !== questId),
        {
          questId,
          ...(this.snapshot.courierBoard.parameters?.[questId] ?? this.snapshot.npcJobs.parameters?.[questId] ? {
            parameters: this.snapshot.courierBoard.parameters?.[questId] ?? this.snapshot.npcJobs.parameters?.[questId]
          } : {}),
          stageIndex: automatic ? 1 : 0,
          ...(first.deadlinePhases ? { deadline: this.clock() + first.deadlinePhases } : {})
        }
      ]
    })
    if (!definition.morningStart) this.prepareDelivery(definition)
    if (!definition.autoStart && !definition.morningStart) this.notify(`Quest added: ${this.definitions.find(quest => quest.id === questId)!.name}.`)

    this.checkInventory()

    return true
  }

  /**
   * Perform stages for QuestService.
   * @param {string} questId - The quest id supplied to this operation.
   * @returns {readonly QuestStage[]} The result described by the TypeScript return signature.
   */
  private stages(questId: string): readonly QuestStage[] {
    const progress = this.snapshot.progress.find(quest => quest.questId === questId)
    const definition = this.definitions.find(quest => quest.id === questId)

    return progress && definition ? activeQuestStages(definition, progress) : []
  }

  /**
   * Perform stage for QuestService.
   * @param {string} questId - The quest id supplied to this operation.
   * @returns {QuestStage | undefined} The result described by the TypeScript return signature.
   */
  private stage(questId: string): QuestStage | undefined {
    return this.stages(questId)[0]
  }

  /**
   * Perform expire for QuestService.
   * @returns {void} Completes the operation without returning a value.
   */
  private expire(): void {
    const expired = this.snapshot.progress.filter(entry => !entry.failed && !this.isCompleted(entry.questId) && entry.deadline !== undefined && this.clock() >= entry.deadline)
    if (!expired.length) return

    this.advancing = true
    try {
      this.publish({
        ...this.snapshot,
        progress: this.snapshot.progress.map(entry => expired.includes(entry) ? { ...entry, failed: true } : entry)
      })

      for (const entry of expired) {
        const definition = this.definitions.find(q => q.id === entry.questId)!
        if (definition.deliveryItemId) this.inventory.discardItemsEverywhere?.([definition.deliveryItemId])

        this.notify(`Delivery expired: ${definition.name}.${definition.deliveryItemId ? ' The delivery parcel was removed. Choose another job when available.' : ' Return to the cashier to restart; replacement goods are not supplied.'}`)
      }
    } finally {
      this.advancing = false
    }
  }

  /**
   * Perform retry stage for QuestService.
   * @param {string} questId - The quest id supplied to this operation.
   * @returns {QuestStage | undefined} The result described by the TypeScript return signature.
   */
  private retryStage(questId: string): QuestStage | undefined {
    const entry = this.snapshot.progress.find(q => q.questId === questId)
    const definition = this.definitions.find(q => q.id === questId)

    return entry?.failed && definition?.retryStage !== undefined ? {
      ...definition.stages[0],
      ...(definition.retryTrigger ? { trigger: { kind: 'dialogue', ...definition.retryTrigger } as const } : {})
    } : undefined
  }

  /**
   * Check whether advance dialogue is allowed.
   * @param {string} questId - The quest id supplied to this operation.
   * @param {string} npcId - The npc id supplied to this operation.
   * @param {string} choiceId - The choice id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canAdvanceDialogue = (
    questId: string,
    npcId: string,
    choiceId: string
  ): boolean => {
    const retry = this.retryStage(questId)
    const definition = this.definitions.find(quest => quest.id === questId)
    if (retry && definition?.deliveryKind && this.definitions.some(other => other.id !== questId && other.deliveryKind === definition.deliveryKind && this.isActive(other.id))) return false

    return (retry ? [retry] : this.stages(questId)).some(stage =>
      !stage.worldInteraction && stage.trigger.kind === 'dialogue' && stage.trigger.npcId === npcId && stage.trigger.choiceId === choiceId
      && (!stage.phases || stage.phases.includes(this.phase())) && canCompleteStage(stage, this.inventory.getSnapshot().items))
  }

  /**
   * Perform advance dialogue for QuestService.
   * @param {string} questId - The quest id supplied to this operation.
   * @param {string} npcId - The npc id supplied to this operation.
   * @param {string} choiceId - The choice id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  advanceDialogue = (
    questId: string,
    npcId: string,
    choiceId: string
  ): boolean => {
    if (this.advancing || !this.canAdvanceDialogue(questId, npcId, choiceId)) return false

    const retry = this.retryStage(questId)
    if (retry) {
      const definition = this.definitions.find(q => q.id === questId)!
      this.publish({
        ...this.snapshot,
        progress: this.snapshot.progress.map(entry => entry.questId === questId
          ? {
            questId,
            stageIndex: definition.retryStage!,
            ...(retry.deadlinePhases ? { deadline: this.clock() + retry.deadlinePhases } : {})
          } : entry)
      })
      this.prepareDelivery(definition)
      this.notify('Delivery restarted. Use your remaining goods or buy replacements; no new items were issued.')

      return true
    }

    const stage = this.stages(questId).find(stage => stage.trigger.kind === 'dialogue' && stage.trigger.npcId === npcId && stage.trigger.choiceId === choiceId)
    if (!stage || !this.complete(questId, stage)) return false

    this.checkInventory()

    return true
  }

  /**
   * Complete the active objective attached to a concrete world interaction.
   * @param {string} interactionId - Authored world-object identifier.
   * @returns {boolean} Whether an eligible objective and its inventory transaction committed.
   */
  interactWorld = (interactionId: string): boolean => {
    if (this.advancing) return false

    for (const progress of this.snapshot.progress) {
      const stage = this.stages(progress.questId).find(stage =>
        stage.worldInteraction === interactionId)
      if (stage && this.complete(progress.questId, stage)) {
        this.checkInventory()
        return true
      }
    }
    return false
  }

  /**
   * Commit an exit, consuming the permit and granting rewards together exactly once.
   * @param {'illegal' | 'official'} route - Alternative exit selected in the world.
   * @returns {boolean} Whether departure prerequisites and complete reward capacity passed.
   */
  completeEscape = (route: 'illegal' | 'official'): boolean => {
    if (this.advancing) return false
    const required = route === 'illegal' ? 'strange-key' : 'exit-permit'
    if (!hasQuestItems(this.inventory.getSnapshot().items, [{ itemId: required, quantity: 1 }])) {
      return false
    }
    const plan = planEscape(this.definitions, this.snapshot.progress, route, this.day())
    if (!plan) return false

    this.advancing = true
    try {
      if (!this.inventory.tryExchangeItems(plan.removals, plan.grants, plan.money)) return false
      this.publish({ ...this.snapshot, progress: plan.progress })
      for (const id of plan.finishedIds) this.onFinished(id)
      return true
    } finally {
      this.advancing = false
    }
  }

  /**
   * Perform complete for QuestService.
   * @param {string} questId - The quest id supplied to this operation.
   * @param {QuestStage | undefined} stage - The stage supplied to this operation.
   * @param {readonly ItemStack[] | undefined} transferredItems - The transferred items supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private complete(
    questId: string,
    stage = this.stage(questId),
    transferredItems?: readonly import('../../../domain/inventory/loot').ItemStack[]
  ): boolean {
    if (!stage || stage.phases && !stage.phases.includes(this.phase()) || !canCompleteStage(
      stage,
      stage.trigger.kind === 'deposit' ? transferredItems ?? [] : this.inventory.getSnapshot().items,
      stage.collectedFrom ? this.inventory.getSnapshot().containers[stage.collectedFrom] : undefined
    )) return false

    const definition = this.definitions.find(quest => quest.id === questId)!
    const progress = this.snapshot.progress.find(quest => quest.questId === questId)!
    const completedStageIds = [...progress.completedStageIds ?? [], stage.id]
    let nextIndex = progress.stageIndex
    while (definition.stages[nextIndex] && completedStageIds.includes(definition.stages[nextIndex].id)) nextIndex++
    const pendingGroup = definition.stages[progress.stageIndex].parallelGroup && this.stages(questId).some(other => other.id !== stage.id)
    if (pendingGroup) nextIndex = progress.stageIndex

    const finished = nextIndex === definition.stages.length
    const removals = [
      ...stage.removeItems ?? [],
      ...(stage.removeRequiredItemGroups ? selectQuestGroupItems(stage, this.inventory.getSnapshot().items) ?? [] : [])
    ]
    this.advancing = true
    try {
      if (stage.grantItems?.length || (finished && definition.reward)) {
        const reward = finished ? definition.reward : undefined
        if (!this.inventory.tryExchangeItems(
          removals,
          [...stage.grantItems ?? [], ...reward?.items ?? []],
          reward?.money ?? 0
        )) return false
      } else if (removals.length && !this.inventory.removeItems(removals)) return false

      this.publish({
        ...this.snapshot,
        progress: this.snapshot.progress.map(quest => quest.questId === questId
          ? {
            ...quest,
            stageIndex: nextIndex,
            ...(finished ? { completedDay: this.day() } : {}),
            ...(pendingGroup ? { completedStageIds } : progress.completedStageIds ? { completedStageIds: [] } : {}),
            ...(stage.deadlinePhases ? { deadline: this.clock() + stage.deadlinePhases } : {})
          } : quest)
      })
      if (definition.deliveryItemId && (stage.trigger.kind === 'deposit' || finished)) this.inventory.discardItemsEverywhere?.([definition.deliveryItemId])

      if (finished) this.onFinished(questId)

      if (finished) this.publish({ ...this.snapshot, npcJobs: this.rollNpcJobs(this.snapshot.npcJobs) })

      this.notify(finished ? `Quest finished: ${definition.name}.${definition.reward ? ' Reward received.' : ''}`
        : `${definition.name} updated.`)

      return true
    } finally {
      this.advancing = false
    }
  }

  /**
   * Perform record action for QuestService.
   * @param {QuestAction} action - The action supplied to this operation.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @returns {void} Completes the operation without returning a value.
   */
  recordAction = (
    action: QuestAction,
    itemId?: string
  ): void => {
    if (this.advancing) return

    for (const progress of this.snapshot.progress) for (const stage of this.stages(progress.questId)) {
      const trigger = stage.trigger
      if (trigger.kind === 'action' && trigger.action === action
        && (!trigger.itemIds || itemId !== undefined && trigger.itemIds.includes(itemId))) this.complete(progress.questId, stage)
    }
  }

  /**
   * Perform visit location for QuestService.
   * @param {string} locationId - The location id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  visitLocation = (locationId: string): void => {
    if (this.advancing) return

    for (const progress of this.snapshot.progress) for (const stage of this.stages(progress.questId)) {
      if (stage.trigger.kind === 'location' && stage.trigger.locationId === locationId
        && this.complete(progress.questId, stage)) this.checkInventory()
    }
  }

  /**
   * Perform visit room for QuestService.
   * @param {string} locationId - The location id supplied to this operation.
   * @param {string} buildingId - The building id supplied to this operation.
   * @param {string} roomId - The room id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  visitRoom = (
    locationId: string,
    buildingId: string,
    roomId: string
  ): void => {
    if (this.advancing) return

    for (const progress of this.snapshot.progress) for (const stage of this.stages(progress.questId)) {
      const trigger = stage.trigger
      if (trigger.kind === 'room' && trigger.locationId === locationId && trigger.buildingId === buildingId
        && trigger.roomId === roomId && this.complete(progress.questId, stage)) this.checkInventory()
    }
  }

  /**
   * Check whether accepted work is present.
   * @param {string} npcId - The npc id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private hasAcceptedWork(npcId: string): boolean {
    return this.snapshot.progress.some(entry => this.templates.some(quest => quest.id === entry.questId && quest.offeredBy === npcId))
  }

  /**
   * Preserve an early Titan-key pickup without requiring testimony already made unnecessary.
   * @returns {void} Publishes and announces the recovered-key objective only once.
   */
  private checkEscapeKey(): void {
    const progress = recognizeEscapeKey(
      this.snapshot.progress, this.templates, this.inventory.getSnapshot().items
    )
    if (progress === this.snapshot.progress) return

    this.publish({ ...this.snapshot, progress })
    const quest = this.definitions.find(quest => quest.id === 'way-out-of-town')!
    this.notify(`${quest.name} updated.`)
  }

  /**
   * Perform check inventory for QuestService.
   * @returns {void} Completes the operation without returning a value.
   */
  private checkInventory = (): void => {
    if (this.advancing) return

    this.checkEscapeKey()

    for (const progress of this.snapshot.progress) {
      let stage: QuestStage | undefined
      while ((stage = this.stages(progress.questId).find(stage => (['inventory', 'accept'].includes(stage.trigger.kind)
        || stage.trigger.kind === 'questAccepted' && this.hasAcceptedWork(stage.trigger.npcId))
        && canCompleteStage(
          stage, this.inventory.getSnapshot().items,
          stage.collectedFrom ? this.inventory.getSnapshot().containers[stage.collectedFrom] : undefined
        )))) {
        if (!this.complete(progress.questId, stage)) break
      }
    }
  }
}
