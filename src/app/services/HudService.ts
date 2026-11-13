import type { HudController, HudSnapshot } from '../contracts/hud'
import { ObservableStore } from './ObservableStore.ts'

export class HudService extends ObservableStore<HudSnapshot> implements HudController {
  private readonly menuIds: readonly string[]
  constructor(menuIds: readonly string[]) { super({ menuId: null }); this.menuIds = menuIds }
  openMenu = (id: string): void => {
    if (this.menuIds.includes(id) && this.snapshot.menuId !== id) this.publish({ menuId: id })
  }
  closeMenu = (): void => { if (this.snapshot.menuId !== null) this.publish({ menuId: null }) }
}
