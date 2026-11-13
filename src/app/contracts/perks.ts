import type { ConsumableBuffDefinition, PerksSnapshot, PerkDefinition } from '../../domain/character/perks'

export interface PerksController {
  recordAction(action: import('../../domain/character/perks').PerkAction): void
  getSnapshot(): PerksSnapshot
  subscribe(listener: () => void): () => void
  readonly definitions: readonly PerkDefinition[]
  readonly buffDefinitions: readonly ConsumableBuffDefinition[]
}
