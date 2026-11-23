import type {
  InventoryController,
  InventorySnapshot,
} from "../../app/contracts/inventory"
import type {
  StatusController,
  StatusSnapshot,
} from "../../app/contracts/status"
import { EQUIPMENT_SLOTS } from "../../domain/inventory/items"
import { INVENTORY_CAPACITY } from '../../domain/inventory/loot'
import { Modal } from "../components/Modal"
import "./inventory.css"
import { ItemDetails } from './ItemDetails'
import { ItemGrid } from './ItemGrid'
import { useInventoryWindow } from './useInventoryWindow'

/**
 * Perform inventory window.
 * @param {{ inventory: InventoryController snapshot: InventorySnapshot vitals: StatusSnapshot status: StatusController }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function InventoryWindow({
  inventory,
  snapshot,
  vitals,
  status,
}: {
  inventory: InventoryController
  snapshot: InventorySnapshot
  vitals: StatusSnapshot
  status: StatusController
}) {
  const { capacity, container, initialSide, selection, setSelection, grids, containerSlots, selectedItems, tradeQuantity, full, move, transfer } = useInventoryWindow({ inventory, snapshot })

  return (
    <Modal
      title={`${container ? `${container.name} ↔ ` : ''}Inventory · Thalers: ${snapshot.money}`}
      onClose={inventory.closeMenu}
      className={`dossier-modal inventory-modal ${container ? "inventory-modal--exchange" : ""}`}
    >
      <div ref={grids} className="inventory-layout">
        <section className="inventory-equipment">
          <h3>Equipment</h3>
          <ItemGrid inventory={inventory} label="Equipment" items={EQUIPMENT_SLOTS.map(slot => snapshot.equipment[slot] ? { itemId: snapshot.equipment[slot]!, quantity: 1 } : undefined)} side="equipment" slots={EQUIPMENT_SLOTS.length} selection={selection} onSelect={setSelection} onMove={move} onTransfer={transfer} autofocus={false} />
        </section>
        <div>
          <div
            className={container ? "inventory-exchange" : undefined}
          >
            <section>
              <h3>Inventory</h3>
              <div className="inventory-player-grids">
                <ItemGrid
                  inventory={inventory}
                  label="Your items"
                  items={snapshot.items}
                  side="inventory"
                  slots={Math.min(INVENTORY_CAPACITY, capacity)}
                  selection={selection}
                  onSelect={setSelection}
                  onMove={move}
                  onTransfer={transfer}
                  autofocus={initialSide === "inventory"}
                />
                {capacity > INVENTORY_CAPACITY && (
                  <fieldset className="inventory-bag-slots">
                    <legend>
                      {capacity > inventory.getCapacity()
                        ? 'Overflow slots — make room to store money'
                        : `Bag slots (+${capacity - INVENTORY_CAPACITY})`}
                    </legend>
                    <ItemGrid
                      inventory={inventory}
                      label="Bag inventory slots"
                      items={snapshot.items}
                      side="inventory"
                      slots={capacity - INVENTORY_CAPACITY}
                      offset={INVENTORY_CAPACITY}
                      selection={selection}
                      onSelect={setSelection}
                      onMove={move}
                      onTransfer={transfer}
                      autofocus={false}
                    />
                  </fieldset>
                )}
              </div>
            </section>
            {container && (
              <section>
                <h3>{container.name}</h3>
                <ItemGrid
                  inventory={inventory}
                  label={container.vendor ? "Vendor items" : "Container items"}
                  items={container.items}
                  side="container"
                  slots={containerSlots}
                  selection={selection}
                  onSelect={setSelection}
                  onMove={move}
                  onTransfer={transfer}
                  autofocus={initialSide === "container"}
                />
              </section>
            )}
          </div>
          <p className="inventory-help" role="status">
            {full
              ? "Inventory full. Matching stacks can still fit. Equip a bag to add slots."
              : "Items stack up to their configured limit."}
            {full && container && !container.lootOnly ? " Store an item to make room." : ""}
          </p>
          <p className="inventory-help">
            {container?.lootOnly
              ? "Arrow keys: Select · Enter: Take loot · Escape: Close"
              : container?.vendor
                ? "Arrow keys: Select across both grids · Enter: Buy or sell one item · Escape: Close"
                : container
                  ? "Arrow keys: Select across both grids · Enter: Move stack to the other side · Escape: Close"
                  : "Arrow keys: Select · Enter: Equip or use item · Escape: Close"}
          </p>
        </div>
        <ItemDetails
          item={selectedItems?.[selection.index]}
          vitals={vitals}
          status={status}
          canConsume={!container}
          trading={Boolean(container?.vendor)}
          selling={selection.side !== "container" || !container?.vendor}
          money={snapshot.money}
          tradeQuantity={tradeQuantity}
          inventory={inventory}
        />
      </div>
    </Modal>
  )
}
