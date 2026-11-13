import { useSyncExternalStore } from "react";
import type {
InventoryController
} from "../../app/contracts/inventory";
import type {
StatusController
} from "../../app/contracts/status";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import "./inventory.css";
import { InventoryWindow } from './InventoryWindow';

export function InventoryMenu({
  inventory,
  status,
}: {
  inventory: InventoryController;
  status: StatusController;
}) {
  const snapshot = useSyncExternalStore(
    inventory.subscribe,
    inventory.getSnapshot,
  );
  const vitals = useSyncExternalStore(status.subscribe, status.getSnapshot);
  if (!snapshot.menu) return null;
  if (snapshot.menu.kind === "keys") {
    const itemId = snapshot.menu.itemId;
    const keys = inventory.getKeys(itemId);
    return (
      <Modal
        title="Keys"
        onClose={inventory.openInventory}
        className="keys-modal"
      >
        <p>Your carried keys open their matching doors automatically.</p>
        <ul aria-label="Your keys">
          {keys.map((key) => (
            <li key={key.id}>{key.name}</li>
          ))}
        </ul>
        {!keys.length && <p>No keys on this ring.</p>}
        <Button onClick={inventory.openInventory} data-autofocus>
          Back to inventory
        </Button>
      </Modal>
    );
  }
  const key =
    snapshot.menu.kind === "container"
      ? snapshot.menu.containerId
      : "inventory";
  return (
    <InventoryWindow
      key={key}
      inventory={inventory}
      snapshot={snapshot}
      vitals={vitals}
      status={status}
    />
  );
}
