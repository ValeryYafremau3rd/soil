import { EQUIPMENT_SLOTS, itemHasStats } from '../../domain/inventory/items.ts'
import { inventoryCapacity } from '../../domain/inventory/loot.ts'
import type { SaveGame } from '../contracts/save'
import { checkSave as check } from './checkSave.ts'
import type { SaveReferences } from './saveReferences.ts'

/**
 * Validate saved inventory against the supported rules.
 * @param {SaveGame} save - The save supplied to this operation.
 * @param {SaveReferences} references - The references supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateSavedInventory(
  save: SaveGame,
  references: SaveReferences
): void {
  check(new Set(save.inventory.readBooks ?? []).size === (save.inventory.readBooks ?? []).length)

  for (const id of save.inventory.readBooks ?? []) check(references.items.some(item => item.id === id && item.readable))

  const previousArmor = save.inventory.equipment?.armor
  if (previousArmor && references.items.find(item => item.id === previousArmor)?.equipmentSlot === 'shoes' && !save.inventory.equipment?.shoes) {
    const equipment = { ...save.inventory.equipment, shoes: previousArmor }
    delete equipment.armor
    save.inventory = { ...save.inventory, equipment }
  }

  const previousTool = save.inventory.equipment?.tool
  const previousDefinition = references.items.find(item => item.id === previousTool)
  if (previousTool && previousDefinition && !previousDefinition.equipmentSlot) {
    const equipment = { ...save.inventory.equipment }
    delete equipment.tool
    save.inventory = {
      ...save.inventory,
      equipment,
      items: [...save.inventory.items, { itemId: previousTool, quantity: 1 }]
    }
  }

  check(save.inventory.items.filter(item => !save.inventory.slotlessMoney
    || item.itemId !== 'money').length <= inventoryCapacity(
    save.inventory.equipment ?? {},
    Object.fromEntries(references.items.map(item => [item.id, item]))
  ))

  /**
   * Validate stacks against the supported rules.
   * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
   * @param {boolean} enforceLimit - The enforce limit supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const validateStacks = (items: SaveGame['inventory']['items'], enforceLimit = true): void => {
    for (const item of items) {
      const definition = references.items.find(candidate => candidate.id === item.itemId)
      check(definition && (!enforceLimit || item.quantity <= (definition.maxStack ?? 1)))
    }
  }

  for (const [slot, id] of Object.entries(save.inventory.equipment ?? {})) {
    check(EQUIPMENT_SLOTS.includes(slot as typeof EQUIPMENT_SLOTS[number]))
    check(references.items.some(item => item.id === id && item.equipmentSlot === slot))
  }

  validateStacks(save.inventory.items)
  if (save.inventory.legendaryBarterStock) {
    const stock = save.inventory.legendaryBarterStock
    validateStacks(stock.items)
    check(new Set(stock.items.map(item => item.itemId)).size === stock.items.length)

    for (const stack of stock.items) {
      const item = references.items.find(item => item.id === stack.itemId)
      check(item && (item.ammunition || itemHasStats(item)) && item.saleable !== false && !item.attachToKeyRing)
      if (stock.visible) check((save.inventory.containers['merchant:worker-basic']?.items.filter(item => item.itemId === stack.itemId).reduce(
        (sum, item) => sum + item.quantity,
        0
      ) ?? 0) >= stack.quantity)
    }
  }

  if (save.inventory.currencyInInventory) check(save.inventory.money === save.inventory.items.reduce(
    (sum, item) => sum + (item.itemId === 'money' ? item.quantity : 0),
    0
  ))

  check(new Set(save.inventory.keyItems ?? []).size === (save.inventory.keyItems ?? []).length)

  for (const id of save.inventory.keyItems ?? []) check(references.items.some(item => item.id === id && item.attachToKeyRing && item.keys?.length))

  check(new Set(save.inventory.lootedCaches ?? []).size === (save.inventory.lootedCaches ?? []).length)

  for (const id of save.inventory.lootedCaches ?? []) check(Object.hasOwn(save.inventory.containers, id))

  const ids = Object.keys(save.inventory.containers)
  check(ids.every(id => references.containerIds.includes(id)) && references.containerIds.every(id =>
    Object.hasOwn(save.inventory.containers, id) || references.optionalContainerIds?.includes(id)))

  for (const container of Object.values(save.inventory.containers)) validateStacks(container.items)

  for (const [id, items] of Object.entries(save.inventory.deposits)) {
    check(Object.hasOwn(save.inventory.containers, id))
    validateStacks(items, false)
    check(new Set(items.map(item => item.itemId)).size === items.length)

    for (const item of items) check(save.inventory.containers[id].items.filter(stack => stack.itemId === item.itemId).reduce(
      (sum, stack) => sum + stack.quantity,
      0
    ) >= item.quantity)
  }
}
