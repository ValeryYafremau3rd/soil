import type { GameServices } from '../contracts/game'

/** Session windows that pause the world while React continues handling menu input. */
export function isMenuOpen(services: GameServices): boolean {
  return services.travel.getSnapshot().menuOpen || services.dialogue.getSnapshot().conversation !== null
    || services.inventory.getSnapshot().menu !== null || services.hud.getSnapshot().menuId !== null
    || services.rest.getSnapshot().menu !== null || services.lockpicking.getSnapshot().puzzle !== null || services.quests.getSnapshot().boardOpen
}

export function isGameplayBlocked(services: GameServices): boolean {
  return services.character === null || isMenuOpen(services) || services.loading.getSnapshot().phase !== 'idle'
}
