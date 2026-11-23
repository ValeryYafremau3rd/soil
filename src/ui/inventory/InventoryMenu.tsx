import { useSyncExternalStore } from "react"
import type {
  InventoryController
} from "../../app/contracts/inventory"
import type {
  StatusController
} from "../../app/contracts/status"
import { Button } from "../components/Button"
import { Modal } from "../components/Modal"
import "./inventory.css"
import { InventoryWindow } from './InventoryWindow'
import { KeysList } from './KeysList'

/**
 * Perform inventory menu.
 * @param {{ inventory: InventoryController status: StatusController }} options - The options supplied to this operation.
 * @returns {Element | null} The result described by the TypeScript return signature.
 */
export function InventoryMenu({
  inventory,
  status,
}: {
  inventory: InventoryController
  status: StatusController
}) {
  const snapshot = useSyncExternalStore(
    inventory.subscribe,
    inventory.getSnapshot,
  )
  const vitals = useSyncExternalStore(status.subscribe, status.getSnapshot)
  if (!snapshot.menu) return null

  if (snapshot.menu.kind === 'reading') {
    const close = snapshot.menu.quickSlot ? inventory.closeMenu : inventory.openInventory

    return (
      <Modal title={snapshot.menu.title} onClose={close} className="dossier-modal">
        <p style={{ whiteSpace: 'pre-line' }}>{snapshot.menu.text}</p>
      </Modal>
    )
  }

  if (snapshot.menu.kind === "keys") {
    const itemId = snapshot.menu.itemId
    const keys = inventory.getKeys(itemId)
    const close = snapshot.menu.quickSlot ? inventory.closeMenu : inventory.openInventory

    return (
      <Modal
        title="Keys"
        onClose={close}
        className="dossier-modal keys-modal"
      >
        <KeysList keys={keys} />
        <Button onClick={close} data-autofocus>
          {snapshot.menu.quickSlot ? 'Close' : 'Back to inventory'}
        </Button>
      </Modal>
    )
  }

  const key =
    snapshot.menu.kind === "container"
      ? snapshot.menu.containerId
      : "inventory"

  return (
    <InventoryWindow
      key={key}
      inventory={inventory}
      snapshot={snapshot}
      vitals={vitals}
      status={status}
    />
  )
}
