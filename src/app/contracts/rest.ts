import type { Recovery } from '../../domain/inventory/items'
export type RestKind = 'rest' | 'sleep'
export interface RestSnapshot { readonly menu: { kind: RestKind; name: string } | null }
export interface RestController {
  getSnapshot(): RestSnapshot
  subscribe(listener: () => void): () => void
  open(kind: RestKind, name: string): void
  confirm(phases?: number): void
  close(): void
  setCombatActive(active: boolean, fearAuraActive?: boolean): void
  getRecovery(kind: RestKind): Recovery
}
