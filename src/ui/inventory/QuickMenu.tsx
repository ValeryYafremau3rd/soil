import { useCallback, useSyncExternalStore } from 'react'
import type { AudioController } from '../../app/contracts/audio'
import type { InventoryController } from '../../app/contracts/inventory'
import type { LoadingController } from '../../app/contracts/loading'
import { ITEM_BY_ID } from '../../content/items'
import { useQuickSlots } from '../../platform/ui/useQuickSlots'
import { ItemIcon } from './ItemIcon'
import './quick-menu.css'

/**
 * Render carried quick slots and connect numeric hotkeys to item actions and feedback.
 * @param {object} options - Observable inventory, loading guard and audio capabilities.
 * @param {InventoryController} options.inventory - Slot contents and item actions.
 * @param {LoadingController} options.loading - Blocks activation during transitions.
 * @param {Pick<AudioController, 'cue'>} options.audio - Shared UI cue at the configured volume.
 * @returns {Element} Quick-slot bar with keyboard and pointer activation.
 */
export function QuickMenu({ inventory, loading, audio }: {
  inventory: InventoryController
  loading: LoadingController
  audio: Pick<AudioController, 'cue'>
}) {
  const snapshot = useSyncExternalStore(inventory.subscribe, inventory.getSnapshot)
  const load = useSyncExternalStore(loading.subscribe, loading.getSnapshot)
  const slots = Math.min(9, inventory.getCapacity())
  const activateSlot = useCallback(
    (slot: number) => {
      if (loading.getSnapshot().phase !== 'idle' || document.querySelector('dialog[open]') || slot >= Math.min(9, inventory.getCapacity())) return

      const item = inventory.getSnapshot().items[slot]
      if (item) inventory.useItem(slot)
    },
    [inventory, loading]
  )
  useQuickSlots(activateSlot, inventory.releaseWeapon, audio)

  return <nav className="quick-menu" aria-label="Quick inventory">
    {Array.from(
      { length: slots },
      (
        _,
        slot
      ) => {
        const item = snapshot.items[slot]
        const definition = item && ITEM_BY_ID[item.itemId]
        const usable = definition && inventory.meetsItemRequirements(item.itemId)
        const label = `${slot + 1}: ${definition ? `${definition.name}, quantity ${item.quantity}${definition.scrap ? ' — Scrap one' : ''}` : 'Empty slot'}`

        return <button type="button" key={slot} aria-label={label} title={label} aria-keyshortcuts={String(slot + 1)}
          disabled={!usable || load.phase !== 'idle'} onPointerDown={event => {
            if (event.button === 0) activateSlot(slot)
          }} onClick={event => {
            if (event.detail === 0) {
              activateSlot(slot)
              inventory.releaseWeapon()
            }
          }}>
          <kbd>{slot + 1}</kbd>
          {item && <><ItemIcon itemId={item.itemId} size={36} />{(definition?.maxStack ?? 1) > 1 && <span className="quick-menu__quantity">{item.quantity}</span>}</>}
        </button>
      }
    )}
  </nav>
}

