import { inventoryCapacity, transferItem } from '../../../domain/inventory/loot.ts'
import { itemWeaponKind } from '../../../domain/inventory/items.ts'
import type { EquipmentSlot, InventoryItemDefinition } from '../../../domain/inventory/items'
import { scrapReward } from '../../../domain/inventory/scrap.ts'
import { removeStackUnit } from '../../../domain/inventory/stacks.ts'
import { occupiedSlots } from '../../../domain/inventory/slotUsage.ts'
import type { StatusController } from '../../contracts/status'
import type { StatisticsController } from '../../contracts/statistics'
import type { InventoryAccess } from './InventoryAccess'
import type { InventoryWeapons } from './InventoryWeapons'

/** Capabilities required to equip, read, scrap and consume carried items. */
interface ItemActionAccess extends InventoryAccess {
  meetsRequirement(definition: InventoryItemDefinition, notify?: boolean): boolean
  notify(text: string): void
  status: Pick<StatusController, 'recover'> & Partial<Pick<StatusController,
    'getItemRecovery' | 'itemConsumed' | 'canConsumeAtMaximum'>>
  weapons: Pick<InventoryWeapons, 'use'>
  scraper(): number
  random(): number
  getCapacity(): number
  onStatistic: StatisticsController['record']
  onScrapped(): void
}

/** Applies item-use actions through the inventory owner's publication boundary. */
export class InventoryItemActions {
  private readonly access: ItemActionAccess

  /**
   * Connect item actions to live inventory state and external recovery effects.
   * @param {ItemActionAccess} access - Explicit transaction and feedback capabilities.
   */
  constructor(access: ItemActionAccess) {
    this.access = access
  }

  /**
   * Return equipped gear to carried storage only when the resulting capacity allows it.
   * @param {"melee" | "ranged" | "tool" | "armor" | "shoes" | "accessory" | "amulet" | "bag"} slot - The slot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  unequip = (slot: EquipmentSlot): void => {
    const itemId = this.access.snapshot.equipment[slot]
    if (!itemId) return

    const equipment = { ...this.access.snapshot.equipment }
    delete equipment[slot]
    const items = [...this.access.snapshot.items, { itemId, quantity: 1 }]
    if (occupiedSlots(items, this.access.slotCost)
      > inventoryCapacity(equipment, this.access.definitions)) {
      this.access.notify('No free room in inventory.')

      return
    }

    this.access.publish({ ...this.access.snapshot, items, equipment })
  }

  /**
   * Apply the selected item action while preserving menu restrictions and effect ordering.
   * @param {number} slot - The slot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  useItem = (slot: number): void => {
    if (!Number.isInteger(slot) || slot < 0) return

    const item = this.access.snapshot.items[slot]
    const definition = item && this.access.definitions[item.itemId]
    if (!item || !definition || !this.access.meetsRequirement(definition)) return

    if ((!this.access.snapshot.menu || this.access.snapshot.menu.kind === 'inventory') && definition.readingText) {
      this.access.publish({
        ...this.access.snapshot,
        menu: {
          kind: 'reading',
          itemId: item.itemId,
          title: 'Letter',
          text: definition.readingText,
          ...(!this.access.snapshot.menu ? { quickSlot: true } : {})
        }
      })

      return
    }

    if ((!this.access.snapshot.menu || this.access.snapshot.menu.kind === 'inventory')
      && definition.equipmentSlot) {
      const equipment = { ...this.access.snapshot.equipment, [definition.equipmentSlot]: item.itemId }
      const previous = this.access.snapshot.equipment[definition.equipmentSlot]
      const items = removeStackUnit(this.access.snapshot.items, slot)
      if (previous) items.push({ itemId: previous, quantity: 1 })

      if (occupiedSlots(items, this.access.slotCost)
        > inventoryCapacity(equipment, this.access.definitions)) {
        this.access.notify('No free room in inventory.')

        return
      }

      this.access.publish({ ...this.access.snapshot, items, equipment })

      return
    }

    if (definition.readable) {
      this.readBook(slot, item.itemId)

      return
    }

    const weaponKind = itemWeaponKind(definition)
    if (weaponKind) {
      if (!this.access.snapshot.menu) this.access.weapons.use(item.itemId, weaponKind, true)

      return
    }

    if (definition.scrap) {
      if (this.access.snapshot.menu && this.access.snapshot.menu.kind !== 'inventory') return

      const reward = scrapReward(this.access.scraper(), this.access.definitions, this.access.random)
      const remaining = removeStackUnit(this.access.snapshot.items, slot)
      const result = reward ? transferItem(
        remaining, [reward], reward.itemId, this.access.getCapacity(), this.access.stackLimit,
        undefined, Infinity, this.access.slotCost
      ) : undefined
      if (result?.remaining.length) {
        this.access.notify('No free room in inventory. Make room for the scrapping result.')

        return
      }

      this.access.publish({ ...this.access.snapshot, items: result?.inventory ?? remaining })
      this.access.onStatistic('itemsScrapped')
      if (reward) this.access.onScrapped()

      this.access.notify(reward ? `Scrapping succeeded: found ${reward.quantity} ${reward.itemId.replaceAll('-', ' ')}.` : 'Scrapped one item. Nothing usable was recovered.')

      return
    }

    if (definition.keys?.length) {
      if (this.access.snapshot.menu?.kind === 'inventory') this.access.publish({ ...this.access.snapshot, menu: { kind: 'keys', itemId: item.itemId } })
      else if (!this.access.snapshot.menu) this.access.publish({ ...this.access.snapshot, menu: { kind: 'keys', itemId: item.itemId, quickSlot: true } })

      return
    }

    if (!definition.consumable || !definition.recovery) return

    const baseRecovery = definition.recovery ?? {}
    const recovery = this.access.status.getItemRecovery?.(baseRecovery, item.itemId) ?? baseRecovery
    if (!this.access.status.recover(recovery) && !this.access.status.canConsumeAtMaximum?.(item.itemId)) return

    this.access.status.itemConsumed?.(item.itemId, baseRecovery)
    const items = removeStackUnit(this.access.snapshot.items, slot)
    this.access.publish({ ...this.access.snapshot, items })
  }

  /**
   * Spend one consumable for a gameplay action, independently of inventory menus.
   * @param {string} itemId - Identifier of the item being processed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  consumeItem = (itemId: string): boolean => {
    if (!this.access.definitions[itemId]?.consumable) return false

    const slot = this.access.snapshot.items.findIndex(item => item.itemId === itemId && item.quantity > 0)
    if (slot < 0) return false

    if (!this.access.meetsRequirement(this.access.definitions[itemId])) return false

    if (this.access.definitions[itemId].readable) return this.readBook(slot, itemId)

    const items = removeStackUnit(this.access.snapshot.items, slot)
    this.access.publish({ ...this.access.snapshot, items })

    return true
  }

  /**
   * Consume an unread book once and persist its learned bonuses.
   * @param {number} slot - The slot supplied to this operation.
   * @param {string} itemId - Identifier of the item being processed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private readBook(
    slot: number,
    itemId: string
  ): boolean {
    if (this.access.snapshot.menu && this.access.snapshot.menu.kind !== 'inventory') return false

    if (this.access.snapshot.readBooks.includes(itemId)) {
      this.access.notify('You have already read this issue, tome or book.')

      return false
    }

    this.access.publish({
      ...this.access.snapshot,
      items: removeStackUnit(this.access.snapshot.items, slot),
      readBooks: [...this.access.snapshot.readBooks, itemId]
    })
    this.access.notify('Read: permanent skill bonuses gained.')

    return true
  }
}
