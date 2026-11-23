import type { GameServices } from '../../contracts/game'

/**
 * Session windows that pause the world while React continues handling menu input.
 * @param {GameServices} services - The services supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function isMenuOpen(services: GameServices): boolean {
  return services.travel.getSnapshot().storySlide != null
    || services.travel.getSnapshot().menuOpen || services.dialogue.getSnapshot().conversation !== null
    || services.inventory.getSnapshot().menu !== null || services.hud.getSnapshot().menuId !== null
    || services.rest.getSnapshot().menu !== null || services.lockpicking.getSnapshot().puzzle !== null || services.quests.getSnapshot().boardOpen
}

/**
 * Check whether gameplay blocked is true.
 * @param {GameServices} services - The services supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function isGameplayBlocked(services: GameServices): boolean {
  return services.story?.getSnapshot().flags.prologue_complete === true
    || services.character === null || isMenuOpen(services)
    || services.loading.getSnapshot().phase !== 'idle'
}
