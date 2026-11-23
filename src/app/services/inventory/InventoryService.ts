import { InventoryItemActions } from './InventoryItemActions.ts'
import { InventoryRequirementChecks } from './InventoryRequirementChecks.ts'
import { InventoryContainerActions } from './InventoryContainerActions.ts'
import { equipReceived, receiveItem } from '../../../domain/inventory/equipment.ts'
import type { Equipment, InventoryItemDefinition, ItemRarity, ItemSkills } from '../../../domain/inventory/items'
import {
  activeBonusItems,
  equipmentItems,
  ITEM_RARITIES,
  itemRequirementStates,
  unmetItemRequirements
} from '../../../domain/inventory/items.ts'
import { attachKeyItems } from '../../../domain/inventory/keys.ts'
import type { ContainerContents, ContainerSeed, ItemStack } from '../../../domain/inventory/loot'
import { inventoryCapacity, seedContainer, transferItem } from '../../../domain/inventory/loot.ts'
import { scrapChance } from '../../../domain/inventory/scrap.ts'
import { quantityOf, withoutItems } from '../../../domain/inventory/stacks.ts'
import { hasFreeBarterPrice, tradePrice } from '../../../domain/inventory/trade.ts'
import type { InventoryController, InventorySnapshot } from '../../contracts/inventory'
import type { SavedInventory } from '../../contracts/save'
import type { StatusController } from '../../contracts/status'
import { InventoryLedger } from './InventoryLedger.ts'
import { InventoryPersistence } from './InventoryPersistence.ts'
import { InventoryStock } from './InventoryStock.ts'
import { InventoryStoreActions } from './InventoryStoreActions.ts'
import { InventoryPickupActions } from './InventoryPickupActions.ts'
import { InventoryWeapons } from './InventoryWeapons.ts'
import { ObservableStore } from '../core/ObservableStore.ts'
import { StatusService } from '../character/StatusService.ts'
import { legendarySkill } from '../../../domain/skills/effects.ts'
import { occupiedSlots } from '../../../domain/inventory/slotUsage.ts'

/**
 * Owns inventory service state and behavior.
 */
export class InventoryService extends ObservableStore<InventorySnapshot> implements InventoryController {
  private slotlessMoney = false
  private visibleSnapshot?: InventorySnapshot

  /**
   * Read stable UI state with perk-exempt money shown only in the wallet total.
   * @returns {InventorySnapshot} Carried item indices match ordinary internal stacks.
   */
  override getSnapshot = (): InventorySnapshot => this.visibleSnapshot ?? this.snapshot

  /**
   * Measure carried stack occupancy under the current currency perk.
   * @param {string} itemId - Item type whose stack is being measured.
   * @returns {number} Zero for exempt money, otherwise one.
   */
  private slotCost = (itemId: string): number =>
    this.slotlessMoney && itemId === 'money' ? 0 : 1

  /**
   * Synchronize currency presentation after effective Barter changes.
   * @returns {void} Publishes only when the currency exemption changes.
   */
  private syncMoneySlots(): void {
    const active = legendarySkill(this.skills(), 'barter')
    if (active === this.slotlessMoney) return

    this.slotlessMoney = active
    this.publish(this.snapshot)
  }
  private readonly ledger = new InventoryLedger(() => this.snapshot)
  private readonly takeActions: InventoryPickupActions
  private readonly storeActions: InventoryStoreActions
  private readonly itemActions: InventoryItemActions
  private readonly requirements: InventoryRequirementChecks
  private readonly containerActions: InventoryContainerActions
  private readonly stock: InventoryStock
  private readonly persistence: InventoryPersistence
  private readonly weapons = new InventoryWeapons({
    snapshot: () => this.snapshot,
    equipped: () => this.getEquippedItems(),
    definitions: () => this.definitions,
    meetsRequirement: (definition, notify) => this.meetsRequirement(definition, notify),
    publish: snapshot => this.publish(snapshot),
    notify: text => this.notify(text),
  })

  /**
   * Read skills.
   * @returns {Partial<Skills>} The result described by the TypeScript return signature.
   */
  getSkills = (): ItemSkills => this.skills()

  /**
   * Perform sync legendary stock for InventoryService.
   * @returns {void} Completes the operation without returning a value.
   */
  syncLegendaryStock = (): void => {
    this.syncMoneySlots()
    return this.stock.syncLegendaryStock()
  }

  /**
   * Read bonus items.
   * @returns {ItemBonusSource[]} The result described by the TypeScript return signature.
   */
  getBonusItems = (): import('../../../domain/inventory/items').ItemBonusSource[] => [
    ...activeBonusItems(this.snapshot.items, this.snapshot.equipment, this.definitions),
    ...this.snapshot.readBooks.map(itemId => ({ itemId, quantity: 1, learned: true }))
  ]

  /**
   * Read equipped items.
   * @returns {ItemStack[]} The result described by the TypeScript return signature.
   */
  getEquippedItems = (): ItemStack[] => equipmentItems(this.snapshot.equipment)

  /**
   * Perform unequip for InventoryService.
   * @param {"melee" | "ranged" | "tool" | "armor" | "shoes" | "accessory" | "amulet" | "bag"} slot - The slot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  unequip = (slot: import('../../../domain/inventory/items').EquipmentSlot): void => {
    return this.itemActions.unequip(slot)
  }
  private readonly definitions: Readonly<Record<string, InventoryItemDefinition>>
  private readonly stackLimit: (id: string) => number
  private readonly seeds: readonly ContainerSeed[]
  private readonly random: () => number

  private readonly tradeModifiers: () => {
    buyPrice: number
    sellPrice: number
  }
  private readonly pickContainerLock?: (id: string, name: string, onUnlocked: () => void, rarity?: ItemRarity) => void
  private readonly notify: (text: string) => void
  private readonly canLoot: (containerId: string) => boolean | string
  private readonly scraper: () => number
  private readonly skills: () => ItemSkills
  private readonly canTake: (containerId: string, itemId: string) => boolean | string

  subscribeDeposit = this.ledger.subscribeDeposit

  /**
   * Perform discard items everywhere for InventoryService.
   * @param {readonly string[]} itemIds - The item ids supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  discardItemsEverywhere = (itemIds: readonly string[]): void => {
    this.containerActions.discardItemsEverywhere(itemIds)
  }

  /**
   * Prepare quest item.
   * @param {string} containerId - The container id supplied to this operation.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {boolean} unique - The unique supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  prepareQuestItem = (containerId: string, itemId: string, unique = true): void => {
    this.containerActions.prepareQuestItem(containerId, itemId, unique)
  }

  /**
   * Initialize the InventoryService instance and its collaborators.
   * @param {readonly (string | InventoryItemDefinition)[]} items - Item stacks to inspect or transform.
   * @param {readonly ContainerSeed[]} containers - The containers supplied to this operation.
   * @param {() => number} random - Random-number source; injectable for deterministic results.
   * @param {readonly ItemStack[]} startingItems - The starting items supplied to this operation.
   * @param {object} status - The status supplied to this operation.
   * @param {() => { buyPrice: number; sellPrice: number; }} tradeModifiers - The trade modifiers supplied to this operation.
   * @param {Function} pickContainerLock - The pick container lock supplied to this operation.
   * @param {(text: string) => void} notify - Callback for presenting an operation message.
   * @param {() => number} erudition - The erudition supplied to this operation.
   * @param {boolean} initialNight - The initial night supplied to this operation.
   * @param {(containerId: string) => string | boolean} canLoot - The can loot supplied to this operation.
   * @param {() => number} scraper - The scraper supplied to this operation.
   * @param {() => Partial<Skills>} skills - The skills supplied to this operation.
   * @param {() => void} onSold - The on sold supplied to this operation.
   * @param {() => void} onScrapped - The on scrapped supplied to this operation.
   * @param {(containerId: string, itemId: string) => string | boolean} canTake - The can take supplied to this operation.
   * @returns {InventoryService} The initialized instance.
   */
  constructor(
    items: readonly (string | InventoryItemDefinition)[],
    containers: readonly ContainerSeed[],
    random: () => number = Math.random,
    startingItems: readonly ItemStack[] = [],
    status: Pick<StatusController, 'recover'> & Partial<Pick<StatusController, 'getItemRecovery' | 'itemConsumed' | 'canConsumeAtMaximum'>> = new StatusService(),
    tradeModifiers: () => {
      buyPrice: number
      sellPrice: number
    } = () => ({ buyPrice: 1, sellPrice: 0.5 }),
    pickContainerLock?: (id: string, name: string, onUnlocked: () => void, rarity?: ItemRarity) => void,
    notify: (text: string) => void = () => { },
    erudition: () => number = () => 0,
    initialNight = false,
    canLoot: (containerId: string) => boolean | string = () => true,
    scraper: () => number = () => 0,
    skills: () => ItemSkills = () => ({}),
    onSold: () => void = () => { },
    onScrapped: () => void = () => { },
    canTake: (containerId: string, itemId: string) => boolean | string = () => true
  ) {
    if (!items.length) throw new Error('Loot requires at least one item')

    if (new Set(containers.map(container => container.id)).size !== containers.length) {
      throw new Error('Container IDs must be unique across locations')
    }

    const definitions = Object.fromEntries(items.map(item => typeof item === 'string' ? [item, { id: item }] : [item.id, item]))
    definitions.money ??= { id: 'money', maxStack: 100, saleable: false }

    /**
     * Perform stack limit.
     * @param {string} id - The id supplied to this operation.
     * @returns {number} The calculated numeric result.
     */
    const stackLimit = (id: string) => definitions[id]?.maxStack ?? 1
    const initialItems = seedContainer(
      { id: 'inventory', name: 'Inventory', locationId: '', items: startingItems },
      random,
      stackLimit
    )
    if (initialItems.length > inventoryCapacity({}, definitions)) throw new Error('Inventory exceeds equipped bag capacity')

    super({
      readBooks: [],
      equipment: {},
      items: initialItems,
      menu: null,
      money: quantityOf(initialItems, 'money'),
      keyItems: [],
      containers: Object.fromEntries(containers.map(container => [
        container.id,
        {
          ...container,
          items: container.restock !== false && (container.nightOnly || container.space === 'outside' && !container.vendor) && !initialNight
            ? [] : seedContainer(container, random, stackLimit),
        }
      ])),
    })
    this.canTake = canTake
    this.onSold = onSold
    this.definitions = definitions
    this.stackLimit = stackLimit
    this.seeds = containers
    this.random = random
    this.tradeModifiers = tradeModifiers
    this.pickContainerLock = pickContainerLock
    this.notify = notify
    this.canLoot = canLoot
    this.scraper = scraper
    this.skills = skills
    this.requirements = new InventoryRequirementChecks({ definitions, skills, erudition, notify })

    /**
     * Perform snapshot.
     * @returns {InventorySnapshot} The result described by the TypeScript return signature.
     */
    const snapshot = () => this.snapshot
    const access = {
      /**
       * Perform snapshot.
       * @returns {InventorySnapshot} The result described by the TypeScript return signature.
       */
      get snapshot() {
        return snapshot()
      },
      definitions: this.definitions,
      stackLimit: this.stackLimit,
      slotCost: this.slotCost,
      publish: (snapshot: InventorySnapshot) => this.publish(snapshot),
      ledger: this.ledger
    }
    this.stock = new InventoryStock({
      ...access,

      /**
       * Perform snapshot.
       * @returns {InventorySnapshot} The result described by the TypeScript return signature.
       */
      get snapshot() {
        return snapshot()
      },
      skills: () => this.skills(),
      random: () => this.random(),
      seeds: this.seeds
    })
    this.persistence = new InventoryPersistence(access)
    this.containerActions = new InventoryContainerActions(access)
    const transfers = {
      ...access,

      /**
       * Perform snapshot.
       * @returns {InventorySnapshot} The result described by the TypeScript return signature.
       */
      get snapshot() {
        return snapshot()
      },
      canTake: this.canTake,
      notify: this.notify,
      getCapacity: () => inventoryCapacity(this.snapshot.equipment, this.definitions),
      getPrice: (id: string, selling?: boolean) => this.getPrice(id, selling),
      attachKeys: (
        items: readonly ItemStack[],
        keyItems?: readonly string[]
      ) => this.attachKeys(items, keyItems),
      equipReceived: (
        items: readonly ItemStack[],
        equipment: Equipment
      ) => this.equipReceived(items, equipment),
      receiveItem: (
        items: readonly ItemStack[],
        source: readonly ItemStack[],
        id: string,
        equipment: Equipment,
        slot: number,
        quantity?: number
      ) => this.receiveItem(items, source, id, equipment, slot, quantity),
      canFitInventory: (items: readonly ItemStack[]) => this.canFitInventory(items),
      onPurchased: (itemId: string) => this.onPurchased(itemId),
      onSold: this.onSold,
      onStatistic: (...args: Parameters<typeof this.onStatistic>) => this.onStatistic(...args),
    }
    this.takeActions = new InventoryPickupActions(transfers)
    this.storeActions = new InventoryStoreActions(transfers)
    this.itemActions = new InventoryItemActions({
      ...access,
      get snapshot() { return snapshot() },
      meetsRequirement: (definition, notify) => this.meetsRequirement(definition, notify),
      notify,
      status,
      weapons: this.weapons,
      scraper,
      random,
      getCapacity: () => inventoryCapacity(this.snapshot.equipment, this.definitions),
      onStatistic: (...args) => this.onStatistic(...args),
      onScrapped,
    })
  }

  /**
   * Read price.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {boolean} selling - The selling supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  getPrice = (
    itemId: string,
    selling = false
  ): number => hasFreeBarterPrice(this.definitions[itemId], this.skills().barter ?? 0) ? 0 : tradePrice(
    this.definitions[itemId],
    selling,
    this.tradeModifiers(),
    this.understandsItem(itemId)
  )

  /**
   * Read scrap chance.
   * @returns {number} The calculated numeric result.
   */
  getScrapChance = (): number => scrapChance(this.scraper())

  /**
   * Read capacity.
   * @returns {number} The calculated numeric result.
   */
  getCapacity = (): number => inventoryCapacity(this.snapshot.equipment, this.definitions)

  /**
   * Perform equipment access for InventoryService.
   * @returns {Function} The result described by the TypeScript return signature.
   */
  private equipmentAccess() {
    return {
      definitions: this.definitions,
      stackLimit: this.stackLimit,
      slotCost: this.slotCost,
      canEquip: (definition: InventoryItemDefinition) => this.meetsRequirement(definition, false)
    }
  }

  /**
   * Perform equip received for InventoryService.
   * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
   * @param {Partial<Record<"melee" | "ranged" | "tool" | "armor" | "shoes" | "accessory" | "amulet" | "bag", string>>} current - The current supplied to this operation.
   * @returns {object} The result described by the TypeScript return signature.
   */
  private equipReceived(
    items: readonly ItemStack[],
    current: Equipment
  ) {
    return equipReceived(items, current, this.equipmentAccess())
  }

  /**
   * Perform receive item for InventoryService.
   * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
   * @param {readonly ItemStack[]} source - Source data or actor used by this operation.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {Partial<Record<"melee" | "ranged" | "tool" | "armor" | "shoes" | "accessory" | "amulet" | "bag", string>>} equipment - The equipment supplied to this operation.
   * @param {number} slot - The slot supplied to this operation.
   * @param {number} maxQuantity - The max quantity supplied to this operation.
   * @returns {object} The result described by the TypeScript return signature.
   */
  private receiveItem(
    items: readonly ItemStack[],
    source: readonly ItemStack[],
    itemId: string,
    equipment: Equipment,
    slot: number,
    maxQuantity = Infinity
  ) {
    return receiveItem(items, source, itemId, equipment, slot, maxQuantity, this.equipmentAccess())
  }

  /**
   * Check whether fit inventory is allowed.
   * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private canFitInventory(items: readonly ItemStack[]): boolean {
    // Losing the perk may leave currency overflow; allow removals to resolve it.
    const capacity = Math.max(
      inventoryCapacity(this.snapshot.equipment, this.definitions),
      occupiedSlots(this.snapshot.items, this.slotCost)
    )
    if (occupiedSlots(items, this.slotCost)
      <= capacity) return true

    this.notify('No free room in inventory.')

    return false
  }

  /**
   * Perform meets item requirements for InventoryService.
   * @param {string} id - The id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  meetsItemRequirements = (id: string): boolean => {
    return this.requirements.meetsItemRequirements(id)
  }

  /**
   * Perform understands item for InventoryService.
   * @param {string} id - The id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  understandsItem = (id: string): boolean => {
    return this.requirements.understandsItem(id)
  }

  /**
   * Read item requirement states.
   * @param {string} id - The id supplied to this operation.
   * @returns {object} The result described by the TypeScript return signature.
   */
  getItemRequirementStates = (id: string): ReturnType<typeof itemRequirementStates> => {
    return this.requirements.getItemRequirementStates(id)
  }

  /**
   * Read unmet item requirements.
   * @param {string} id - The id supplied to this operation.
   * @returns {object} The result described by the TypeScript return signature.
   */
  getUnmetItemRequirements = (id: string): ReturnType<typeof unmetItemRequirements> => {
    return this.requirements.getUnmetItemRequirements(id)
  }

  /**
   * Check whether use item is allowed.
   * @param {string} itemId - Identifier of the item being processed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canUseItem = (itemId: string): boolean => {
    return this.requirements.canUseItem(itemId)
  }

  /**
   * Read keys.
   * @param {string} itemId - Identifier of the item being processed.
   * @returns {readonly { id: string; name: string; doorId: string; }[]} The result described by the TypeScript return signature.
   */
  getKeys = (itemId: string): NonNullable<InventoryItemDefinition['keys']> => {
    if (!this.snapshot.items.some(item => item.itemId === itemId && item.quantity > 0)) return []

    const keys = [...this.definitions[itemId]?.keys ?? [], ...(itemId === 'key-ring'
      ? this.snapshot.keyItems.flatMap(id => this.definitions[id]?.keys ?? []) : [])]

    return [...new Map(keys.map(key => [key.doorId, key])).values()]
  }

  /**
   * Check whether door key is present.
   * @param {string} doorId - The door id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  hasDoorKey = (doorId: string): boolean => this.snapshot.items.some(item => this.getKeys(item.itemId).some(key => key.doorId === doorId))

  subscribeLoot = this.ledger.subscribeLoot

  /**
   * Perform attach keys for InventoryService.
   * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
   * @param {readonly string[]} keyItems - The key items supplied to this operation.
   * @param {Readonly<Record<string, ContainerContents>>} containers - The containers supplied to this operation.
   * @returns {{ items: readonly ItemStack[]; keyItems: string[]; }} The result described by the TypeScript return signature.
   */
  private attachKeys(
    items: readonly ItemStack[],
    keyItems = this.snapshot.keyItems,
    containers = this.snapshot.containers
  ) {
    return attachKeyItems(items, keyItems, containers, this.definitions)
  }

  /**
   * Perform publish for InventoryService.
   * @param {InventorySnapshot} snapshot - State snapshot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  protected override publish(snapshot: InventorySnapshot): void {
    const attached = this.attachKeys(snapshot.items, snapshot.keyItems, snapshot.containers)
    const items = this.slotlessMoney
      ? [...attached.items.filter(item => item.itemId !== 'money'),
        ...attached.items.filter(item => item.itemId === 'money')]
      : attached.items
    const next = {
      ...snapshot,
      ...attached,
      items,
      money: quantityOf(snapshot.items, 'money')
    }
    this.visibleSnapshot = this.slotlessMoney
      ? { ...next, items: next.items.filter(item => item.itemId !== 'money') }
      : next
    super.publish(next)
  }

  /**
   * Save state.
   * @returns {SavedInventory} The result described by the TypeScript return signature.
   */
  saveState = (): SavedInventory => {
    return this.persistence.saveState()
  }

  /**
   * Restore state.
   * @param {SavedInventory} saved - The saved supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  restoreState = (saved: SavedInventory): void => {
    this.persistence.restoreState(saved)
    this.syncMoneySlots()
  }

  /**
   * Add temporary container.
   * @param {Pick<ContainerContents, "items" | "id" | "name" | "locationId">} container - The container supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  addTemporaryContainer = (container: Pick<ContainerContents, 'id' | 'name' | 'locationId' | 'items'>): void => {
    this.containerActions.addTemporaryContainer(container)
  }

  /**
   * Remove temporary container.
   * @param {string} containerId - The container id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  removeTemporaryContainer = (containerId: string): void => {
    this.containerActions.removeTemporaryContainer(containerId)
  }

  /**
   * Refresh renewable supplies, preserving finite caches, vendor gear and player deposits.
   * @param {"morning" | "night"} phase - The phase supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  refreshContainers = (phase: 'morning' | 'night' = 'morning'): void => {
    return this.stock.refreshContainers(phase)
  }

  /**
   * Perform grant items for InventoryService.
   * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
   * @param {number} money - The money supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  grantItems = (
    items: readonly ItemStack[],
    money = 0
  ): void => {
    if (!this.tryExchangeItems([], items, money)) throw new Error('Inventory exceeds equipped bag capacity')
  }

  /**
   * Perform on purchased for InventoryService.
   * @returns {void} Completes the operation without returning a value.
   */
  onPurchased: (itemId: string) => void = () => { }

  /**
   * Perform on statistic for InventoryService.
   * @returns {void} Completes the operation without returning a value.
   */
  onStatistic: import('../../contracts/statistics').StatisticsController['record'] = () => { }

  /**
   * Perform spend money for InventoryService.
   * @param {number} amount - Amount to apply to the operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  spendMoney = (amount: number): boolean => {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > this.snapshot.money) return false

    if (amount === 0) return true

    if (!this.removeItems([{ itemId: 'money', quantity: amount }])) return false

    this.onStatistic('moneySpent', amount)

    return true
  }

  /**
   * Open inventory.
   * @returns {void} Completes the operation without returning a value.
   */
  openInventory = (): void => {
    this.syncMoneySlots()
    if (this.snapshot.menu?.kind !== 'inventory') this.publish({ ...this.snapshot, menu: { kind: 'inventory' } })
  }

  /**
   * Open container.
   * @param {string} containerId - The container id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  openContainer = (containerId: string): void => {
    this.syncLegendaryStock()
    if (!Object.hasOwn(this.snapshot.containers, containerId)) return

    const container = this.snapshot.containers[containerId]
    if (!container.vendor || container.requiresQuest) {
      const access = this.canLoot(containerId)
      if (access !== true) {
        this.notify(typeof access === 'string' ? access : "I can't do that when others see me.")

        return
      }
    }

    if (container.keyOnly && !this.hasDoorKey('container:' + containerId)) {
      this.notify('A matching key is required to open this safe.')

      return
    }

    if (container.locked && !this.hasDoorKey('container:' + containerId)) {
      const rarity = container.lockRarity ?? [...ITEM_RARITIES].reverse().find(rarity => container.items.some(item => this.definitions[item.itemId]?.rarity === rarity)) ?? 'common'
      this.pickContainerLock?.(
        containerId,
        container.name,
        () => {
          this.publish({
            ...this.snapshot,
            containers: {
              ...this.snapshot.containers,
              [containerId]: { ...this.snapshot.containers[containerId], locked: false },
            }
          })
        },
        rarity
      )

      return
    }

    this.publish({ ...this.snapshot, menu: { kind: 'container', containerId } })
  }

  /**
   * Close menu.
   * @returns {void} Completes the operation without returning a value.
   */
  closeMenu = (): void => {
    if (this.snapshot.menu) this.publish({ ...this.snapshot, menu: null })
  }

  /**
   * Perform take item for InventoryService.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {number | undefined} slot - The slot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  takeItem = (
    itemId: string,
    slot?: number
  ): void => {
    return this.takeActions.takeItem(itemId, slot)
  }

  /**
   * Perform take all for InventoryService.
   * @returns {void} Completes the operation without returning a value.
   */
  takeAll = (): void => {
    return this.takeActions.takeAll()
  }

  private readonly onSold: () => void

  /**
   * Perform store item for InventoryService.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {number | undefined} slot - The slot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  storeItem = (
    itemId: string,
    slot?: number
  ): void => {
    return this.storeActions.storeItem(itemId, slot)
  }

  /**
   * Perform swap items for InventoryService.
   * @param {string} inventoryItemId - The inventory item id supplied to this operation.
   * @param {string} containerItemId - The container item id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  swapItems = (
    inventoryItemId: string,
    containerItemId: string
  ): void => {
    return this.storeActions.swapItems(inventoryItemId, containerItemId)
  }

  /**
   * Perform use item for InventoryService.
   * @param {number} slot - The slot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  useItem = (slot: number): void => {
    return this.itemActions.useItem(slot)
  }

  /**
   * Remove quest requirements atomically across inventory slots.
   * @param {readonly ItemStack[]} requested - The requested supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  removeItems = (requested: readonly ItemStack[]): boolean => {
    const items = withoutItems(this.snapshot.items, requested)
    if (!items) return false

    if (!this.canFitInventory(items)) return false

    if (requested.length) this.publish({ ...this.snapshot, items })

    return true
  }

  /**
   * Check the whole reward after turn-in removals, then publish once.
   * @param {readonly ItemStack[]} remove - The remove supplied to this operation.
   * @param {readonly ItemStack[]} add - The add supplied to this operation.
   * @param {number} money - The money supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  tryExchangeItems = (
    remove: readonly ItemStack[],
    add: readonly ItemStack[],
    money = 0
  ): boolean => {
    this.syncMoneySlots()
    let items = withoutItems(this.snapshot.items, remove)
    if (!items || !Number.isSafeInteger(money) || money < 0 || !Number.isSafeInteger(this.snapshot.money + money)) return false

    add = [...add, ...(money ? [{ itemId: 'money', quantity: money }] : [])]

    for (const item of add) if (!this.definitions[item.itemId] || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return false

    const attached = this.attachKeys([...items, ...add])
    const ordinary = add.filter(item => !this.definitions[item.itemId]?.attachToKeyRing)
    if (attached.items.some(item => item.itemId === 'key-ring') && ![...items, ...ordinary].some(item => item.itemId === 'key-ring')) ordinary.push({ itemId: 'key-ring', quantity: 1 })

    const received = this.equipReceived(ordinary, this.snapshot.equipment)
    const capacity = inventoryCapacity(received.equipment, this.definitions)
    if (occupiedSlots(items, this.slotCost) > capacity) {
      this.canFitInventory(items)

      return false
    }

    for (const item of received.items) {
      if (!this.definitions[item.itemId] || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return false

      const result = transferItem(
        items, [item], item.itemId, capacity, this.stackLimit, undefined, Infinity,
        this.slotCost
      )
      if (result.remaining.length) {
        this.notify('No free room in inventory. Make room for the whole quest reward.')

        return false
      }

      items = result.inventory
    }

    this.publish({
      ...this.snapshot,
      items,
      equipment: received.equipment,
      keyItems: attached.keyItems,
      money: this.snapshot.money + money
    })
    this.onStatistic('moneyEarned', quantityOf(add, 'money'))
    this.onStatistic('moneySpent', quantityOf(remove, 'money'))

    return true
  }

  /**
   * Spend one consumable for a gameplay action, independently of inventory menus.
   * @param {string} itemId - Identifier of the item being processed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  consumeItem = (itemId: string): boolean => {
    return this.itemActions.consumeItem(itemId)
  }

  releaseWeapon = this.weapons.releaseWeapon

  getWeaponDamageMultiplier = this.weapons.getWeaponDamageMultiplier

  subscribeWeaponUse = this.weapons.subscribeWeaponUse

  canShoot = this.weapons.canShoot

  tryShoot = this.weapons.tryShoot

  /**
   * Perform meets requirement for InventoryService.
   * @param {InventoryItemDefinition} definition - The definition supplied to this operation.
   * @param {boolean} notify - Callback for presenting an operation message.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private meetsRequirement(definition: InventoryItemDefinition, notify = true): boolean {
    return this.requirements.meetsRequirement(definition, notify)
  }
}

