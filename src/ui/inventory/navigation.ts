import config from '../../content/ui/inventory.json' with { type: 'json' }
import { EQUIPMENT_SLOTS } from '../../domain/inventory/items.ts'

export type InventorySide = 'inventory' | 'container' | 'equipment'
export interface GridPosition { side: InventorySide; index: number }
export type GridDirection = 'left' | 'right' | 'up' | 'down'

export function containerSlotCount(itemCount: number): number {
  return Math.max(config.minimumContainerSlots, Math.ceil(itemCount / config.gridColumns) * config.gridColumns)
}

export function moveEquippedSelection(position: GridPosition, direction: GridDirection,
  inventorySlots: number, containerSlots = 0): GridPosition {
  if (position.side === 'equipment') return direction === 'down'
    ? { side: 'inventory', index: Math.min(position.index, config.gridColumns - 1) }
    : { side: 'equipment', index: Math.max(0, Math.min(EQUIPMENT_SLOTS.length - 1,
      position.index + (direction === 'left' ? -1 : direction === 'right' ? 1 : 0))) }
  if (position.side === 'inventory' && position.index < config.gridColumns && direction === 'up') {
    return { side: 'equipment', index: position.index }
  }
  return moveInventorySelection(position, direction, inventorySlots, containerSlots)
}

/** Player/container grids share row coordinates, including their empty slots. */
export function moveInventorySelection(position: GridPosition, direction: GridDirection,
  inventorySlots: number, containerSlots = 0): GridPosition {
  const { side, index } = position
  const slots = side === 'inventory' ? inventorySlots : containerSlots
  const columns = config.gridColumns
  const column = index % columns
  const row = Math.floor(index / columns)
  if (direction === 'up' || direction === 'down') {
    const next = index + (direction === 'up' ? -columns : columns)
    return next >= 0 && next < slots ? { side, index: next } : position
  }
  if (direction === 'right') {
    if (column < columns - 1 && index + 1 < slots) return { side, index: index + 1 }
    if (side === 'inventory' && containerSlots > 0) {
      return { side: 'container', index: Math.min(row, Math.floor((containerSlots - 1) / columns)) * columns }
    }
  } else {
    if (column > 0) return { side, index: index - 1 }
    if (side === 'container' && inventorySlots > 0) {
      return { side: 'inventory', index: Math.min(row * columns + columns - 1, inventorySlots - 1) }
    }
  }
  return position
}
