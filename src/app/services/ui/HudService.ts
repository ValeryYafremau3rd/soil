import type { HudController, HudSnapshot } from '../../contracts/hud'
import { ObservableStore } from '../core/ObservableStore.ts'

/**
 * Owns hud service state and behavior.
 */
export class HudService extends ObservableStore<HudSnapshot> implements HudController {
  private readonly menuIds: readonly string[]

  /**
   * Initialize the HudService instance and its collaborators.
   * @param {readonly string[]} menuIds - The menu ids supplied to this operation.
   * @returns {HudService} The initialized instance.
   */
  constructor(menuIds: readonly string[]) {
    super({ menuId: null })
    this.menuIds = menuIds
  }

  /**
   * Open menu.
   * @param {string} id - The id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  openMenu = (id: string): void => {
    if (this.menuIds.includes(id) && this.snapshot.menuId !== id) this.publish({ menuId: id })
  }

  /**
   * Close menu.
   * @returns {void} Completes the operation without returning a value.
   */
  closeMenu = (): void => {
    if (this.snapshot.menuId !== null) this.publish({ menuId: null })
  }
}
