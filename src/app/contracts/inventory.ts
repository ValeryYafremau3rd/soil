import type { ContainerContents, ItemStack } from '../../domain/inventory/loot'
import type { InventoryItemDefinition } from '../../domain/inventory/items'
import type { unmetItemRequirements } from '../../domain/inventory/items'
import type { itemRequirementStates } from '../../domain/inventory/items'

export interface LootPickup { containerId: string; items: readonly ItemStack[] }

export type InventoryMenu = { kind: 'inventory' } | { kind: 'container'; containerId: string } | { kind: 'keys'; itemId: string }

export interface InventorySnapshot {
  readonly equipment: import('../../domain/inventory/items').Equipment
  readonly money: number
  readonly keyItems: readonly string[]
  readonly items: readonly ItemStack[]
  readonly containers: Readonly<Record<string, ContainerContents>>
  readonly menu: InventoryMenu | null
}

export interface InventoryController {
  getSnapshot(): InventorySnapshot
  subscribe(listener: () => void): () => void
  subscribeDeposit(listener: (deposit: LootPickup) => void): () => void
  prepareQuestItem(containerId: string, itemId: string, unique?: boolean): void
  discardItemsEverywhere(itemIds: readonly string[]): void
  subscribeLoot(listener: (pickup: LootPickup) => void): () => void
  subscribeWeaponUse(listener: (itemId: string, kind: 'melee' | 'shot', held: boolean) => void): () => void
  releaseWeapon(): void
  getKeys(itemId: string): NonNullable<InventoryItemDefinition['keys']>
  openInventory(): void
  openContainer(containerId: string): void
  addTemporaryContainer(container: Pick<ContainerContents, 'id' | 'name' | 'locationId' | 'items'>): void
  removeTemporaryContainer(containerId: string): void
  closeMenu(): void
  takeItem(itemId: string, slot?: number): void
  takeAll(): void
  storeItem(itemId: string, slot?: number): void
  swapItems(inventoryItemId: string, containerItemId: string): void
  unequip(slot: import('../../domain/inventory/items').EquipmentSlot): void
  syncLegendaryStock(): void
  getSkills(): import('../../domain/inventory/items').ItemSkills
  getBonusItems(): readonly ItemStack[]
  getEquippedItems(): readonly ItemStack[]
  useItem(slot: number): void
  consumeItem(itemId: string): boolean
  removeItems(items: readonly ItemStack[]): boolean
  tryExchangeItems(remove: readonly ItemStack[], add: readonly ItemStack[], money?: number): boolean
  tryShoot(itemId?: string): boolean
  canShoot(itemId?: string): boolean
  getWeaponDamageMultiplier(kind: 'melee' | 'shot', itemId?: string): number
  refreshContainers(phase?: 'morning' | 'night'): void
  meetsItemRequirements(itemId: string): boolean
  understandsItem(itemId: string): boolean
  getUnmetItemRequirements(itemId: string): ReturnType<typeof unmetItemRequirements>
  getItemRequirementStates(itemId: string): ReturnType<typeof itemRequirementStates>
  getPrice(itemId: string, selling?: boolean): number
  getScrapChance(): number
  getCapacity(): number
}
