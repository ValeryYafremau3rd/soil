import { equipReceived,receiveItem } from '../../domain/inventory/equipment.ts'
import type { Equipment,InventoryItemDefinition,ItemRarity,ItemSkills } from '../../domain/inventory/items'
import { activeBonusItems,equipmentItems,ITEM_RARITIES,itemRequirementStates,itemWeaponKind,understandsItem,unmetItemRequirements } from '../../domain/inventory/items.ts'
import { attachKeyItems } from '../../domain/inventory/keys.ts'
import type { ContainerContents,ContainerSeed,ItemStack } from '../../domain/inventory/loot'
import { inventoryCapacity,normalizeStacks,seedContainer,transferItem } from '../../domain/inventory/loot.ts'
import { scrapChance,scrapReward } from '../../domain/inventory/scrap.ts'
import { quantityOf,removeStackUnit,withoutItems } from '../../domain/inventory/stacks.ts'
import { tradePrice } from '../../domain/inventory/trade.ts'
import { SKILL_LABELS } from '../../domain/skills/character.ts'
import type { InventoryController,InventorySnapshot } from '../contracts/inventory'
import type { SavedInventory } from '../contracts/save'
import type { StatusController } from '../contracts/status'
import { InventoryLedger } from './InventoryLedger.ts'
import { InventoryPersistence } from './InventoryPersistence.ts'
import { InventoryStock } from './InventoryStock.ts'
import { InventoryStoreActions } from './InventoryStoreActions.ts'
import { InventoryTakeActions } from './InventoryTakeActions.ts'
import { InventoryWeapons } from './InventoryWeapons.ts'
import { ObservableStore } from './ObservableStore.ts'
import { StatusService } from './StatusService.ts'



export class InventoryService extends ObservableStore<InventorySnapshot> implements InventoryController {
  private readonly ledger = new InventoryLedger(() => this.snapshot)
  private readonly takeActions: InventoryTakeActions
  private readonly storeActions: InventoryStoreActions
  private readonly stock: InventoryStock
  private readonly persistence: InventoryPersistence
  private readonly weapons = new InventoryWeapons({
 snapshot: () => this.snapshot, equipped: () => this.getEquippedItems(), definitions: () => this.definitions,
 meetsRequirement: (definition, notify) => this.meetsRequirement(definition, notify),
 publish: snapshot => this.publish(snapshot), notify: text => this.notify(text),
})
  getSkills = (): ItemSkills => this.skills()
  
  
  syncLegendaryStock = (): void => { return this.stock.syncLegendaryStock() }
  getBonusItems = (): ItemStack[] => activeBonusItems(this.snapshot.items, this.snapshot.equipment, this.definitions)
  getEquippedItems = (): ItemStack[] => equipmentItems(this.snapshot.equipment)
  unequip = (slot: import('../../domain/inventory/items').EquipmentSlot): void => {
    const itemId = this.snapshot.equipment[slot]
    if (!itemId) return
    const equipment = { ...this.snapshot.equipment }
    delete equipment[slot]
    const items = [...this.snapshot.items, { itemId, quantity: 1 }]
    if (items.length > inventoryCapacity(equipment, this.definitions)) { this.notify('No free room in inventory.'); return }
    this.publish({ ...this.snapshot, items, equipment })
  }
  private readonly definitions: Readonly<Record<string, InventoryItemDefinition>>
  private readonly status: Pick<StatusController, 'recover'> & Partial<Pick<StatusController, 'getItemRecovery' | 'itemConsumed' | 'canConsumeAtMaximum'>>
  private readonly stackLimit: (id: string) => number
  private readonly seeds: readonly ContainerSeed[]
  private readonly random: () => number
  
  
  private readonly tradeModifiers: () => { buyPrice: number; sellPrice: number }
  private readonly pickContainerLock?: (id: string, name: string, onUnlocked: () => void, rarity?: ItemRarity) => void
  private readonly notify: (text: string) => void
  private readonly erudition: () => number
  private readonly canLoot: (containerId: string) => boolean | string
  private readonly scraper: () => number
  private readonly skills: () => ItemSkills
  private readonly canTake: (containerId: string, itemId: string) => boolean | string
  
  subscribeDeposit = this.ledger.subscribeDeposit
  discardItemsEverywhere = (itemIds: readonly string[]): void => {
    const ids = new Set(itemIds)
    const filter = (items: readonly ItemStack[]) => items.filter(item => !ids.has(item.itemId))
    const items = filter(this.snapshot.items)
    const containers = Object.fromEntries(Object.entries(this.snapshot.containers).map(([id, container]) => [id, { ...container, items: filter(container.items) }]))
    for (const stored of this.ledger.deposits.values()) for (const id of ids) stored.delete(id)
    if (items.length !== this.snapshot.items.length || Object.entries(containers).some(([id, c]) => c.items.length !== this.snapshot.containers[id].items.length)) this.publish({ ...this.snapshot, items, containers })
  }
  prepareQuestItem = (containerId: string, itemId: string, unique = true): void => {
    const container = this.snapshot.containers[containerId]
    if (!container || !this.definitions[itemId]) return
    if (unique) this.discardItemsEverywhere([itemId])
    else if (quantityOf(container.items, itemId) > (this.ledger.deposits.get(containerId)?.get(itemId) ?? 0)) return
    this.publish({ ...this.snapshot, containers: { ...this.snapshot.containers,
      [containerId]: { ...this.snapshot.containers[containerId], items: [...this.snapshot.containers[containerId].items, { itemId, quantity: 1 }] } } })
  }
  
  
  

  constructor(items: readonly (string | InventoryItemDefinition)[], containers: readonly ContainerSeed[], random: () => number = Math.random,
    startingItems: readonly ItemStack[] = [], status: Pick<StatusController, 'recover'> & Partial<Pick<StatusController, 'getItemRecovery' | 'itemConsumed' | 'canConsumeAtMaximum'>> = new StatusService(),
    tradeModifiers: () => { buyPrice: number; sellPrice: number } = () => ({ buyPrice: 1, sellPrice: 0.5 }),
    pickContainerLock?: (id: string, name: string, onUnlocked: () => void, rarity?: ItemRarity) => void,
    notify: (text: string) => void = () => {}, erudition: () => number = () => 0, initialNight = false,
    canLoot: (containerId: string) => boolean | string = () => true, scraper: () => number = () => 0, skills: () => ItemSkills = () => ({}), onSold: () => void = () => {}, onScrapped: () => void = () => {}, canTake: (containerId: string, itemId: string) => boolean | string = () => true) {
    if (!items.length) throw new Error('Loot requires at least one item')
    if (new Set(containers.map(container => container.id)).size !== containers.length) {
      throw new Error('Container IDs must be unique across locations')
    }
    const definitions = Object.fromEntries(items.map(item => typeof item === 'string' ? [item, { id: item }] : [item.id, item]))
    definitions.money ??= { id: 'money', maxStack: 100, saleable: false }
    const stackLimit = (id: string) => definitions[id]?.maxStack ?? 1
    const initialItems = seedContainer({ id: 'inventory', name: 'Inventory', locationId: '', items: startingItems }, random, stackLimit)
    if (initialItems.length > inventoryCapacity({}, definitions)) throw new Error('Inventory exceeds equipped bag capacity')
    super({
      equipment: {}, items: initialItems, menu: null, money: quantityOf(initialItems, 'money'), keyItems: [],
      containers: Object.fromEntries(containers.map(container => [container.id, {
        ...container, items: container.restock !== false && (container.nightOnly || container.space === 'outside' && !container.vendor) && !initialNight
          ? [] : seedContainer(container, random, stackLimit),
      }])),
    })
    this.canTake = canTake
    this.onSold = onSold
    this.onScrapped = onScrapped
    this.definitions = definitions
    this.stackLimit = stackLimit
    this.status = status
    this.seeds = containers
    this.random = random
    this.tradeModifiers = tradeModifiers
    this.pickContainerLock = pickContainerLock
    this.notify = notify
    this.erudition = erudition
    this.canLoot = canLoot
    this.scraper = scraper
    this.skills = skills
    const service = this
    const access = { get snapshot() { return service.snapshot }, definitions: this.definitions,
      stackLimit: this.stackLimit, publish: (snapshot: InventorySnapshot) => this.publish(snapshot), ledger: this.ledger }
    this.stock = new InventoryStock({ ...access, get snapshot() { return service.snapshot }, skills: () => this.skills(), random: () => this.random(), seeds: this.seeds })
    this.persistence = new InventoryPersistence(access)
    const transfers = { ...access, get snapshot() { return service.snapshot }, canTake: this.canTake, notify: this.notify,
      getCapacity: () => this.getCapacity(), getPrice: (id: string, selling?: boolean) => this.getPrice(id, selling),
      attachKeys: (items: readonly ItemStack[], keyItems?: readonly string[]) => this.attachKeys(items, keyItems),
      equipReceived: (items: readonly ItemStack[], equipment: Equipment) => this.equipReceived(items, equipment),
      receiveItem: (items: readonly ItemStack[], source: readonly ItemStack[], id: string, equipment: Equipment, slot: number, quantity?: number) => this.receiveItem(items, source, id, equipment, slot, quantity),
      canFitInventory: (items: readonly ItemStack[]) => this.canFitInventory(items),
      onSold: this.onSold, onStatistic: (...args: Parameters<typeof this.onStatistic>) => this.onStatistic(...args),
    }
    this.takeActions = new InventoryTakeActions(transfers)
    this.storeActions = new InventoryStoreActions(transfers)

  }

  getPrice = (itemId: string, selling = false): number => tradePrice(this.definitions[itemId], selling, this.tradeModifiers(), this.understandsItem(itemId))
  getScrapChance = (): number => scrapChance(this.scraper())
  getCapacity = (): number => inventoryCapacity(this.snapshot.equipment, this.definitions)

  private equipmentAccess() { return { definitions: this.definitions, stackLimit: this.stackLimit, canEquip: (definition: InventoryItemDefinition) => this.meetsRequirement(definition,false) } }
  private equipReceived(items: readonly ItemStack[], current: Equipment) { return equipReceived(items,current,this.equipmentAccess()) }

  private receiveItem(items: readonly ItemStack[], source: readonly ItemStack[], itemId: string, equipment: Equipment, slot: number, maxQuantity = Infinity) { return receiveItem(items,source,itemId,equipment,slot,maxQuantity,this.equipmentAccess()) }

  private canFitInventory(items: readonly ItemStack[]): boolean {
    if (items.length <= this.getCapacity()) return true
    this.notify('No free room in inventory.')
    return false
  }

  meetsItemRequirements = (id: string): boolean => !!this.definitions[id] && this.meetsRequirement(this.definitions[id], false)
  understandsItem = (id: string): boolean => !!this.definitions[id] && understandsItem(this.definitions[id], this.erudition(), this.skills())
  getItemRequirementStates = (id: string): ReturnType<typeof itemRequirementStates> => this.definitions[id]
    ? itemRequirementStates(this.definitions[id], { ...this.skills(), erudition: this.erudition() }) : []
  getUnmetItemRequirements = (id: string): ReturnType<typeof unmetItemRequirements> => this.definitions[id]
    ? unmetItemRequirements(this.definitions[id], { ...this.skills(), erudition: this.erudition() }) : []

  canUseItem = (itemId: string): boolean => {
    const definition = this.definitions[itemId]
    return !!definition && this.meetsRequirement(definition)
  }

  getKeys = (itemId: string): NonNullable<InventoryItemDefinition['keys']> => {
    if (!this.snapshot.items.some(item => item.itemId === itemId && item.quantity > 0)) return []
    const keys = [...this.definitions[itemId]?.keys ?? [], ...(itemId === 'key-ring'
      ? this.snapshot.keyItems.flatMap(id => this.definitions[id]?.keys ?? []) : [])]
    return [...new Map(keys.map(key => [key.doorId, key])).values()]
  }
  hasDoorKey = (doorId: string): boolean => this.snapshot.items.some(item => this.getKeys(item.itemId).some(key => key.doorId === doorId))

  subscribeLoot = this.ledger.subscribeLoot
  

  private attachKeys(items: readonly ItemStack[], keyItems = this.snapshot.keyItems, containers = this.snapshot.containers) { return attachKeyItems(items,keyItems,containers,this.definitions) }

  protected override publish(snapshot: InventorySnapshot): void {
    super.publish({ ...snapshot, ...this.attachKeys(snapshot.items, snapshot.keyItems, snapshot.containers), money: quantityOf(snapshot.items, 'money') })
  }

  saveState = (): SavedInventory => { return this.persistence.saveState() }
  restoreState = (saved: SavedInventory): void => { return this.persistence.restoreState(saved) }

  addTemporaryContainer = (container: Pick<ContainerContents, 'id' | 'name' | 'locationId' | 'items'>): void => {
    if (this.ledger.temporaryContainers.has(container.id)) return
    if (!container.id || Object.hasOwn(this.snapshot.containers, container.id)) throw new Error('Temporary container ID must be unique')
    for (const stack of container.items) {
      if (!this.definitions[stack.itemId] || !Number.isSafeInteger(stack.quantity) || stack.quantity < 1) throw new Error('Invalid temporary container item')
    }
    const items = normalizeStacks(container.items, this.stackLimit)
    this.ledger.temporaryContainers.add(container.id)
    this.publish({ ...this.snapshot, containers: { ...this.snapshot.containers,
      [container.id]: { ...container, items, locked: false, lootOnly: true } } })
  }

  removeTemporaryContainer = (containerId: string): void => {
    if (!this.ledger.temporaryContainers.delete(containerId)) return
    const containers = { ...this.snapshot.containers }
    delete containers[containerId]
    this.ledger.deposits.delete(containerId)
    this.publish({ ...this.snapshot, containers,
      menu: this.snapshot.menu?.kind === 'container' && this.snapshot.menu.containerId === containerId ? null : this.snapshot.menu })
  }

  /** Refresh renewable supplies, preserving finite caches, vendor gear and player deposits. */
  refreshContainers = (phase: 'morning' | 'night' = 'morning'): void => { return this.stock.refreshContainers(phase) }

  

  grantItems = (items: readonly ItemStack[], money = 0): void => {
    if (!this.tryExchangeItems([], items, money)) throw new Error('Inventory exceeds equipped bag capacity')
  }

  onStatistic: import('../contracts/statistics').StatisticsController['record'] = () => {}
  spendMoney = (amount: number): boolean => {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > this.snapshot.money) return false
    if (amount === 0) return true
    if (!this.removeItems([{ itemId: 'money', quantity: amount }])) return false
    this.onStatistic('moneySpent', amount)
    return true
  }

  openInventory = (): void => {
    if (this.snapshot.menu?.kind !== 'inventory') this.publish({ ...this.snapshot, menu: { kind: 'inventory' } })
  }

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
    if (container.locked) {
      const rarity = container.lockRarity ?? [...ITEM_RARITIES].reverse().find(rarity => container.items.some(item => this.definitions[item.itemId]?.rarity === rarity)) ?? 'common'
      this.pickContainerLock?.(containerId, container.name, () => {
        this.publish({ ...this.snapshot, containers: {
          ...this.snapshot.containers, [containerId]: { ...this.snapshot.containers[containerId], locked: false },
        } })
      }, rarity)
      return
    }
    this.publish({ ...this.snapshot, menu: { kind: 'container', containerId } })
  }

  closeMenu = (): void => {
    if (this.snapshot.menu) this.publish({ ...this.snapshot, menu: null })
  }

  takeItem = (itemId: string, slot?: number): void => { return this.takeActions.takeItem(itemId, slot) }

  takeAll = (): void => { return this.takeActions.takeAll() }

  private readonly onSold: () => void
  private readonly onScrapped: () => void

  storeItem = (itemId: string, slot?: number): void => { return this.storeActions.storeItem(itemId, slot) }

  swapItems = (inventoryItemId: string, containerItemId: string): void => { return this.storeActions.swapItems(inventoryItemId, containerItemId) }

  useItem = (slot: number): void => {
    if (!Number.isInteger(slot) || slot < 0) return
    const item = this.snapshot.items[slot]
    const definition = item && this.definitions[item.itemId]
    if (!item || !definition || !this.meetsRequirement(definition)) return
    if (this.snapshot.menu?.kind === 'inventory' && definition.equipmentSlot) {
      const equipment = { ...this.snapshot.equipment, [definition.equipmentSlot]: item.itemId }
      const previous = this.snapshot.equipment[definition.equipmentSlot]
      const items = removeStackUnit(this.snapshot.items, slot)
      if (previous) items.push({ itemId: previous, quantity: 1 })
      if (items.length > inventoryCapacity(equipment, this.definitions)) { this.notify('No free room in inventory.'); return }
      this.publish({ ...this.snapshot, items, equipment })
      return
    }
    const weaponKind = itemWeaponKind(definition)
    if (weaponKind) {
      if (!this.snapshot.menu) this.weapons.use(item.itemId, weaponKind, true)
      return
    }
    if (definition.scrap) {
      if (this.snapshot.menu && this.snapshot.menu.kind !== 'inventory') return
      const reward = scrapReward(this.scraper(), this.definitions, this.random)
      const remaining = removeStackUnit(this.snapshot.items, slot)
      const result = reward ? transferItem(remaining, [reward], reward.itemId, this.getCapacity(), this.stackLimit) : undefined
      if (result?.remaining.length) { this.notify('No free room in inventory. Make room for the scrapping result.'); return }
      this.publish({ ...this.snapshot, items: result?.inventory ?? remaining })
      this.onStatistic('itemsScrapped')
      if (reward) this.onScrapped()
      this.notify(reward ? `Scrapping succeeded: found ${reward.quantity} ${reward.itemId.replaceAll('-', ' ')}.` : 'Scrapped one item. Nothing usable was recovered.')
      return
    }
    if (definition.keys?.length) {
      if (this.snapshot.menu?.kind === 'inventory') this.publish({ ...this.snapshot, menu: { kind: 'keys', itemId: item.itemId } })
      return
    }
    if (!definition.consumable || !definition.recovery) return
    const baseRecovery = definition.recovery ?? {}
    const recovery = this.status.getItemRecovery?.(baseRecovery, item.itemId) ?? baseRecovery
    if (!this.status.recover(recovery) && !this.status.canConsumeAtMaximum?.(item.itemId)) return
    this.status.itemConsumed?.(item.itemId, baseRecovery)
    const items = removeStackUnit(this.snapshot.items, slot)
    this.publish({ ...this.snapshot, items })
  }

  /** Remove quest requirements atomically across inventory slots. */
  removeItems = (requested: readonly ItemStack[]): boolean => {
    const items = withoutItems(this.snapshot.items, requested)
    if (!items) return false
    if (!this.canFitInventory(items)) return false
    if (requested.length) this.publish({ ...this.snapshot, items })
    return true
  }

  

  /** Check the whole reward after turn-in removals, then publish once. */
  tryExchangeItems = (remove: readonly ItemStack[], add: readonly ItemStack[], money = 0): boolean => {
    let items = withoutItems(this.snapshot.items, remove)
    if (!items || !Number.isSafeInteger(money) || money < 0 || !Number.isSafeInteger(this.snapshot.money + money)) return false
    add = [...add, ...(money ? [{ itemId: 'money', quantity: money }] : [])]
    for (const item of add) if (!this.definitions[item.itemId] || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return false
    const attached = this.attachKeys([...items, ...add])
    const ordinary = add.filter(item => !this.definitions[item.itemId]?.attachToKeyRing)
    if (attached.items.some(item => item.itemId === 'key-ring') && ![...items, ...ordinary].some(item => item.itemId === 'key-ring')) ordinary.push({ itemId: 'key-ring', quantity: 1 })
    const received = this.equipReceived(ordinary, this.snapshot.equipment)
    const capacity = inventoryCapacity(received.equipment, this.definitions)
    if (items.length > capacity) { this.canFitInventory(items); return false }
    for (const item of received.items) {
      if (!this.definitions[item.itemId] || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return false
      const result = transferItem(items, [item], item.itemId, capacity, this.stackLimit)
      if (result.remaining.length) {
          this.notify('No free room in inventory. Make room for the whole quest reward.')
        return false
      }
      items = result.inventory
    }
    this.publish({ ...this.snapshot, items, equipment: received.equipment, keyItems: attached.keyItems, money: this.snapshot.money + money })
    this.onStatistic('moneyEarned', quantityOf(add, 'money'))
    this.onStatistic('moneySpent', quantityOf(remove, 'money'))
    return true
  }

  /** Spend one consumable for a gameplay action, independently of inventory menus. */
  consumeItem = (itemId: string): boolean => {
    if (!this.definitions[itemId]?.consumable) return false
    const slot = this.snapshot.items.findIndex(item => item.itemId === itemId && item.quantity > 0)
    if (slot < 0) return false
    if (!this.meetsRequirement(this.definitions[itemId])) return false
    const items = removeStackUnit(this.snapshot.items, slot)
    this.publish({ ...this.snapshot, items })
    return true
  }

  
  releaseWeapon = this.weapons.releaseWeapon

  

  getWeaponDamageMultiplier = this.weapons.getWeaponDamageMultiplier

  subscribeWeaponUse = this.weapons.subscribeWeaponUse

  canShoot = this.weapons.canShoot

  tryShoot = this.weapons.tryShoot

  private meetsRequirement(definition: InventoryItemDefinition, notify = true): boolean {
    if (!understandsItem(definition, this.erudition(), this.skills())) {
      if (notify) this.notify(`Requires Erudition ${definition.eruditionRequired}`)
      return false
    }
    const missing = unmetItemRequirements(definition, { ...this.skills(), erudition: this.erudition() })
    if (!missing.length) return true
    if (notify) this.notify(missing.map(({ skill, required, current }) => `Requires ${SKILL_LABELS[skill]} ${required}. Your ${SKILL_LABELS[skill]} is ${current}.`).join(' '))
    return false
  }

}

