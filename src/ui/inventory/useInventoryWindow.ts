import { useRef, useState } from "react"
import type {
  InventoryController,
  InventorySnapshot,
} from "../../app/contracts/inventory"
import { EQUIPMENT_SLOTS } from "../../domain/inventory/items"
import "./inventory.css"
import type { GridDirection, GridPosition, InventorySide } from "./navigation"
import { containerSlotCount, moveEquippedSelection } from './navigation'
import { selectedInventoryItem } from './selectedInventoryItem'

/**
 * Perform use inventory window.
 * @param {{ inventory: InventoryController snapshot: InventorySnapshot }} options - The options supplied to this operation.
 * @returns {Function} The result described by the TypeScript return signature.
 */
export function useInventoryWindow({
  inventory,
  snapshot,
}: {
  inventory: InventoryController
  snapshot: InventorySnapshot
}) {
  const menu = snapshot.menu
  const capacity = Math.max(inventory.getCapacity(), snapshot.items.length)
  const container =
    menu?.kind === "container"
      ? snapshot.containers[menu.containerId]
      : undefined
  const initialSide: InventorySide =
    snapshot.items.length || !container ? "inventory" : "container"
  const [selection, setSelection] = useState<GridPosition>({
    side: initialSide,
    index: 0,
  })
  const grids = useRef<HTMLDivElement>(null)
  const containerSlots = container
    ? containerSlotCount(container.items.length)
    : 0
  const { selectedItems, tradeQuantity } = selectedInventoryItem(snapshot, selection, capacity, container)
  const full = snapshot.items.length >= capacity

  /**
   * Select and focus.
   * @param {GridPosition} position - The position supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const selectAndFocus = (position: GridPosition) => {
    setSelection(position)
    grids.current?.querySelector<HTMLButtonElement>(`button[data-side="${position.side}"][data-slot="${position.index}"]`)?.focus()
  }

  /**
   * Perform move.
   * @param {GridPosition} position - The position supplied to this operation.
   * @param {GridDirection} direction - The direction supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const move = (position: GridPosition, direction: GridDirection) => {
    const next = moveEquippedSelection(position, direction, capacity, containerSlots)
    selectAndFocus(next)
  }

  /**
   * Perform transfer.
   * @param {GridPosition} position - The position supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const transfer = (position: GridPosition) => {
    if (position.side === "equipment") {
      inventory.unequip(EQUIPMENT_SLOTS[position.index])

      return
    }

    if (!container) {
      if (position.side === "inventory") {
        inventory.useItem(position.index)
        const lastSlot = inventory.getCapacity() - 1
        if (position.index > lastSlot) {
          selectAndFocus({ side: "inventory", index: lastSlot })
        }
      }

      return
    }

    const item = (
      position.side === "inventory" ? snapshot.items : container.items
    )[position.index]
    if (!item) return

    if (position.side === "inventory")
      inventory.storeItem(item.itemId, position.index)
    else inventory.takeItem(item.itemId, position.index)

    if (
      position.side === "inventory" &&
      position.index >= inventory.getCapacity()
    ) {
      const next = { side: position.side, index: inventory.getCapacity() - 1 }
      selectAndFocus(next)
    }
    // Slots use stable index keys. Keep focus in the same slot even when it becomes empty.
    if (position.side === "container") {
      const remaining =
        inventory.getSnapshot().containers[container.id].items.length
      const slots = containerSlotCount(remaining)
      if (position.index >= slots) {
        const next = { side: position.side, index: slots - 1 }
        selectAndFocus(next)
      }
    }
  }

  return {
    capacity,
    container,
    initialSide,
    selection,
    setSelection,
    grids,
    containerSlots,
    selectedItems,
    tradeQuantity,
    full,
    move,
    transfer
  }
}
