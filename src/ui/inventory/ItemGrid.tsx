import type {
  InventoryController
} from "../../app/contracts/inventory"
import { ITEM_BY_ID } from "../../content/items"
import { UI_CONFIG } from '../../content/ui'
import { EQUIPMENT_SLOTS } from "../../domain/inventory/items"
import type { ItemStack } from "../../domain/inventory/loot"
import { menuAction } from '../../platform/ui/menuNavigation'
import "./inventory.css"
import { ItemIcon } from "./ItemIcon"
import type { GridDirection, GridPosition, InventorySide } from "./navigation"
import { inventoryAppearance } from './rarity'

/**
 * Perform item grid.
 * @param {Function} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ItemGrid({
  label,
  items,
  side,
  slots,
  selection,
  onSelect,
  onMove,
  onTransfer,
  autofocus,
  offset = 0,
  inventory,
}: {
  label: string
  items: readonly (ItemStack | undefined)[]
  side: InventorySide
  slots: number
  selection: GridPosition
  onSelect: (position: GridPosition) => void
  onMove: (position: GridPosition, direction: GridDirection) => void
  onTransfer: (position: GridPosition) => void
  autofocus: boolean
  offset?: number
  inventory: InventoryController
}) {
  return (
    <ul style={side === "equipment" ? undefined : { gridTemplateColumns: `repeat(${UI_CONFIG.gridColumns}, minmax(0, 1fr))` }} className={`inventory-grid ${side === "equipment" ? "inventory-grid--equipment" : ""}`} aria-label={label}>
      {Array.from(
        { length: slots },
        (
          _,
          localIndex
        ) => {
          const index = localIndex + offset
          const item = items[index]
          const equipmentLabel = side === "equipment" ? ({
            ranged: "Ranged weapon",
            melee: "Melee weapon",
            tool: "Tool",
            armor: "Armor",
            shoes: "Shoes",
            accessory: "Accessory",
            amulet: "Amulet",
            bag: "Bag"
          }[EQUIPMENT_SLOTS[index]]) : undefined
          const position = { side, index }

          return (
            <li key={index}>
              <button
                type="button"
                className={`inventory-slot ${item && !inventory.meetsItemRequirements(item.itemId) ? "inventory-slot--unusable" : ""} ${item ? "" : "inventory-slot--empty"}`}
                data-side={side}
                data-slot={index}
                data-appearance={item ? inventoryAppearance(ITEM_BY_ID[item.itemId], inventory.understandsItem(item.itemId)) : undefined}
                data-loot-rarity={item ? ITEM_BY_ID[item.itemId].rarity : undefined}
                data-understood={item ? inventory.understandsItem(item.itemId) : undefined}
                aria-pressed={
                  selection.side === side && selection.index === index
                }
                aria-label={
                  item
                    ? `${equipmentLabel ? equipmentLabel + ": " : ""}${ITEM_BY_ID[item.itemId].name}, quantity ${item.quantity}`
                    : equipmentLabel ? `${equipmentLabel}: Empty slot` : "Empty slot"
                }
                data-autofocus={autofocus && index === 0 ? true : undefined}
                onFocus={() => onSelect(position)}
                onClick={() => onSelect(position)}
                onKeyDown={(event) => {
                  const action = menuAction(event)
                  if (action === 'choose') {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!event.repeat) onTransfer(position)

                    return
                  }

                  if (!action || action === 'first' || action === 'last') return

                  event.preventDefault()
                  event.stopPropagation()
                  onMove(position, action)
                }}
              >
                {side === 'inventory' && index < 9 && <kbd>{index + 1}</kbd>}
                {equipmentLabel && <span className="inventory-slot__name inventory-slot__equipment-label">{equipmentLabel}</span>}
                {item ? (
                  <>
                    <ItemIcon itemId={item.itemId} />
                    <span className="inventory-slot__name inventory-slot__item-name">
                      {ITEM_BY_ID[item.itemId].name}
                    </span>
                    {(ITEM_BY_ID[item.itemId].maxStack ?? 1) > 1 && <span className="inventory-slot__quantity">
                      {item.quantity}/{ITEM_BY_ID[item.itemId].maxStack ?? 1}
                    </span>}
                  </>
                ) : (
                  <span className="inventory-slot__empty" aria-hidden="true">+</span>
                )}
              </button>
            </li>
          )
        }
      )}
    </ul>
  )
}
