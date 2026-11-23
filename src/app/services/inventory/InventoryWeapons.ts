import { spendShot } from '../../../domain/combat/shooting.ts'
import type { InventoryItemDefinition } from '../../../domain/inventory/items'
import { itemWeaponKind } from '../../../domain/inventory/items.ts'
import type { ItemStack } from '../../../domain/inventory/loot'
import type { InventorySnapshot } from '../../contracts/inventory'
import { EventChannel } from '../core/EventChannel.ts'
/**
 * Narrow inventory capabilities required by combat input and weapon use.
 */
interface WeaponInventory {
  snapshot(): InventorySnapshot
  equipped(): ItemStack[]
  definitions(): Readonly<Record<string, InventoryItemDefinition>>
  meetsRequirement(definition: InventoryItemDefinition, notify?: boolean): boolean
  publish(snapshot: InventorySnapshot): void
  notify(text: string): void
}

/**
 * Owns inventory weapons state and behavior.
 */
export class InventoryWeapons {
  private readonly inventory: WeaponInventory
  private readonly events = new EventChannel<[itemId: string, kind: 'melee' | 'shot', held: boolean]>()

  /**
   * Initialize the InventoryWeapons instance and its collaborators.
   * @param {WeaponInventory} inventory - Inventory capability used to read or transact items.
   * @returns {InventoryWeapons} The initialized instance.
   */
  constructor(inventory: WeaponInventory) {
    this.inventory = inventory
  }
  use = this.events.emit

  /**
   * Perform release weapon for InventoryWeapons.
   * @returns {void} Completes the operation without returning a value.
   */
  releaseWeapon = (): void => {
    this.use('', 'melee', false)
  }

  /**
   * Perform strongest weapon for InventoryWeapons.
   * @param {"melee" | "shot"} kind - The kind supplied to this operation.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @returns {InventoryItemDefinition | undefined} The result described by the TypeScript return signature.
   */
  private strongestWeapon(
    kind: 'melee' | 'shot',
    itemId?: string
  ): InventoryItemDefinition | undefined {
    const weapons = this.inventory.equipped().filter(stack => {
      const definition = this.inventory.definitions()[stack.itemId]
      if (!definition || stack.quantity <= 0 || itemId && stack.itemId !== itemId || itemWeaponKind(definition) !== kind || !this.inventory.meetsRequirement(definition, false)) return false

      const ammo = definition.firearm?.ammunitionId

      return !ammo || this.inventory.snapshot().items.some(item => item.itemId === ammo && item.quantity > 0) && this.inventory.meetsRequirement(this.inventory.definitions()[ammo], false)
    })

    return weapons.reduce<InventoryItemDefinition | undefined>(
      (
        best,
        stack
      ) => {
        const weapon = this.inventory.definitions()[stack.itemId]

        return !best || (weapon.damageMultiplier ?? 1) > (best.damageMultiplier ?? 1) ? weapon : best
      },
      undefined
    )
  }

  /**
   * Read weapon damage multiplier.
   * @param {"melee" | "shot"} kind - The kind supplied to this operation.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @returns {number} The calculated numeric result.
   */
  getWeaponDamageMultiplier = (
    kind: 'melee' | 'shot',
    itemId?: string
  ): number => this.strongestWeapon(kind, itemId)?.damageMultiplier ?? 1

  /**
   * Subscribe to weapon use.
   * @param {(itemId: string, kind: "melee" | "shot", held: boolean) => void} listener - Callback invoked when the observable value changes.
   * @returns {() => void} Callback that releases or performs the registered operation.
   */
  subscribeWeaponUse = (listener: (itemId: string, kind: 'melee' | 'shot', held: boolean) => void): (() => void) => {
    return this.events.subscribe(listener)
  }

  /**
   * Check whether shoot is allowed.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canShoot = (itemId?: string): boolean => {
    if (this.inventory.snapshot().menu) return false

    const guns = this.inventory.equipped().filter(item => item.quantity > 0 && this.inventory.definitions()[item.itemId]?.firearm && (!itemId || item.itemId === itemId))
    if (!guns.length) {
      this.inventory.notify('You need a gun to shoot.')

      return false
    }

    const loaded = guns.filter(item => {
      const firearm = this.inventory.definitions()[item.itemId]?.firearm

      return firearm && this.inventory.definitions()[firearm.ammunitionId]?.ammunition
        && this.inventory.snapshot().items.some(ammo => ammo.itemId === firearm.ammunitionId && ammo.quantity > 0)
    })
    if (!loaded.length) {
      this.inventory.notify('No compatible ammunition.')

      return false
    }

    const weapon = loaded.find(item => this.inventory.meetsRequirement(this.inventory.definitions()[item.itemId], false)
      && this.inventory.meetsRequirement(
        this.inventory.definitions()[this.inventory.definitions()[item.itemId].firearm!.ammunitionId],
        false
      )) ?? loaded[0]
    const definition = this.inventory.definitions()[weapon.itemId]

    return this.inventory.meetsRequirement(definition) && this.inventory.meetsRequirement(this.inventory.definitions()[definition.firearm!.ammunitionId])
  }

  /**
   * Perform try shoot for InventoryWeapons.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  tryShoot = (itemId?: string): boolean => {
    if (!this.canShoot(itemId)) return false

    const weapon = this.strongestWeapon('shot', itemId)
    if (!weapon) return false

    const combined = [...this.inventory.snapshot().items, ...this.inventory.equipped()]
    const spent = spendShot(
      combined,
      this.inventory.definitions(),
      definition => (!definition.firearm || definition.id === weapon.id) && this.inventory.meetsRequirement(definition, false)
    )
    if (spent === combined) return false

    const items = spent.slice(0, spent.length - this.inventory.equipped().length)
    this.inventory.publish({ ...this.inventory.snapshot(), items })

    return true
  }
}
