import type {
InventorySnapshot
} from "../../app/contracts/inventory";
import { ITEM_BY_ID } from "../../content/items";
import { EQUIPMENT_SLOTS } from "../../domain/inventory/items";
import "./inventory.css";
import type { GridPosition } from "./navigation";
export function selectedInventoryItem(snapshot: InventorySnapshot, selection: GridPosition, capacity: number, container?: InventorySnapshot['containers'][string]) {
const selectedItems =
    selection.side === "equipment" ? EQUIPMENT_SLOTS.map(slot => snapshot.equipment[slot] ? { itemId: snapshot.equipment[slot]!, quantity: 1 } : undefined) : selection.side === "inventory" ? snapshot.items : container?.items;
const selectedItem = selectedItems?.[selection.index];
const stackLimit = selectedItem
    ? (ITEM_BY_ID[selectedItem.itemId].maxStack ?? 1)
    : 1;
const availableRoom = snapshot.items.reduce(
    (room, item) =>
      room +
      (item.itemId === selectedItem?.itemId ? stackLimit - item.quantity : 0),
    (capacity - snapshot.items.length) * stackLimit,
  );
const tradeQuantity = selectedItem
    ? container?.vendor
      ? selection.side === "inventory"
        ? ITEM_BY_ID[selectedItem.itemId].saleable === false
          ? 0
          : 1
        : Math.min(1, availableRoom)
      : selection.side === "inventory"
        ? selectedItem.quantity
        : Math.min(selectedItem.quantity, availableRoom)
    : 0;
return { selectedItems, tradeQuantity }
}
