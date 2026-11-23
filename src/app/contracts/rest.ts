import type { Recovery } from '../../domain/inventory/items'
export type RestKind = 'rest' | 'sleep'
/**
 * Observable rest state exposed to service subscribers.
 */
export interface RestSnapshot {
  readonly menu: {
    kind: RestKind
    name: string
  } | null
}
/**
 * Typed rest actions and queries exposed across application layers.
 */
export interface RestController {
  getSnapshot(): RestSnapshot
  subscribe(listener: () => void): () => void
  open(kind: RestKind, name: string): void
  confirm(phases?: number): void
  close(): void
  setCombatActive(active: boolean, fearAuraActive?: boolean): void
  getRecovery(kind: RestKind): Recovery
}
