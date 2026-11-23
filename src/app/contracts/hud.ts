/**
 * Observable hud state exposed to service subscribers.
 */
export interface HudSnapshot {
  readonly menuId: string | null
}
/**
 * Typed hud actions and queries exposed across application layers.
 */
export interface HudController {
  getSnapshot(): HudSnapshot
  subscribe(listener: () => void): () => void
  openMenu(id: string): void
  closeMenu(): void
}
