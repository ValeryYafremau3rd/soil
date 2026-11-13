import type { Recovery } from '../../domain/inventory/items'
import type { AttributeVitalConfig } from '../../domain/skills/vitals'

export interface StatusSnapshot { readonly health: number; readonly energy: number; readonly sanity: number }
export interface StatusController {
  getSnapshot(): StatusSnapshot
  subscribe(listener: () => void): () => void
  recover(recovery: Recovery): boolean
  takeDamage(amount: number): void
  drain(amounts: Pick<Recovery, 'energy' | 'sanity'>): void
  getLimits(): Readonly<StatusSnapshot>
  getItemRecovery(recovery: Recovery, itemId?: string): Recovery
  itemConsumed?(itemId: string, recovery: Recovery): void
  canConsumeAtMaximum?(itemId: string): boolean
  getRecovery(recovery: Recovery): Recovery
}
export type VitalConfig = AttributeVitalConfig
