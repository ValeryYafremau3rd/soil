import type { GameServices } from '../contracts/game'

type WindowServices = Pick<GameServices, 'hud' | 'inventory' | 'travel' | 'dialogue' | 'rest'> & Partial<Pick<GameServices, 'lockpicking' | 'quests'>>

/** Any successfully opened window closes the other session windows. */
export function coordinateWindows(services: WindowServices): () => void {
  const windows: { store: { subscribe(listener: () => void): () => void }; isOpen: () => boolean; close: () => void }[] = [
    { store: services.hud, isOpen: () => services.hud.getSnapshot().menuId !== null, close: services.hud.closeMenu },
    { store: services.inventory, isOpen: () => services.inventory.getSnapshot().menu !== null, close: services.inventory.closeMenu },
    { store: services.travel, isOpen: () => services.travel.getSnapshot().menuOpen, close: services.travel.closeTravel },
    { store: services.dialogue, isOpen: () => services.dialogue.getSnapshot().conversation !== null, close: services.dialogue.closeDialogue },
    { store: services.rest, isOpen: () => services.rest.getSnapshot().menu !== null, close: services.rest.close },
  ]
  if (services.lockpicking) {
    const lock = services.lockpicking
    windows.push({ store: lock, isOpen: () => lock.getSnapshot().puzzle !== null, close: lock.close })
  }
  if (services.quests) {
    const quests = services.quests
    windows.push({ store: quests, isOpen: () => quests.getSnapshot().boardOpen, close: quests.closeBoard })
  }
  const unsubscribe = windows.map(window => window.store.subscribe(() => {
    if (!window.isOpen()) return
    for (const other of windows) if (other !== window) other.close()
  }))
  return () => { for (const release of unsubscribe) release() }
}
