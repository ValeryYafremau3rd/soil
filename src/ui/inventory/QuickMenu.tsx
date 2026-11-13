import { useCallback, useSyncExternalStore } from 'react'
import type { InventoryController } from '../../app/contracts/inventory'
import type { LoadingController } from '../../app/contracts/loading'
import { ITEM_BY_ID } from '../../content/items'
import { itemWeaponKind } from '../../domain/inventory/items'
import { useQuickSlots } from '../../platform/ui/useQuickSlots'
import { ItemIcon } from './ItemIcon'
import './quick-menu.css'

export function QuickMenu({ inventory, loading }: { inventory: InventoryController; loading: LoadingController }) {
  const snapshot = useSyncExternalStore(inventory.subscribe, inventory.getSnapshot)
  const load = useSyncExternalStore(loading.subscribe, loading.getSnapshot)
  const slots = Math.min(9, inventory.getCapacity())
  const activateSlot = useCallback((slot: number) => {
    if (loading.getSnapshot().phase !== 'idle' || document.querySelector('dialog[open]') || slot >= Math.min(9, inventory.getCapacity())) return
    const item = inventory.getSnapshot().items[slot]
    if (item) inventory.useItem(slot)
  }, [inventory, loading])
  useQuickSlots(activateSlot, inventory.releaseWeapon)

  return <nav className="quick-menu" aria-label="Quick inventory">
    {Array.from({ length: slots }, (_, slot) => {
      const item = snapshot.items[slot]
      const definition = item && ITEM_BY_ID[item.itemId]
      const usable = definition && (definition.consumable || itemWeaponKind(definition)) && inventory.meetsItemRequirements(item.itemId)
      const label = `${slot + 1}: ${definition ? `${definition.name}, quantity ${item.quantity}${definition.scrap ? ' — Scrap one' : ''}` : 'Empty slot'}`
      return <button type="button" key={slot} aria-label={label} title={label} aria-keyshortcuts={String(slot + 1)}
        disabled={!usable || load.phase !== 'idle'} onPointerDown={event => {
          if (event.button === 0) activateSlot(slot)
        }} onClick={event => {
          if (event.detail === 0) { activateSlot(slot); inventory.releaseWeapon() }
        }}>
        <kbd>{slot + 1}</kbd>
        {item && <><ItemIcon itemId={item.itemId} size={36} />{(definition?.maxStack ?? 1) > 1 && <span className="quick-menu__quantity">{item.quantity}</span>}</>}
      </button>
    })}
  </nav>
}

