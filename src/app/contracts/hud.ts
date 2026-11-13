export interface HudSnapshot { readonly menuId: string | null }
export interface HudController {
  getSnapshot(): HudSnapshot
  subscribe(listener: () => void): () => void
  openMenu(id: string): void
  closeMenu(): void
}
