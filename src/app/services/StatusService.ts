import type { StatusController, StatusSnapshot, VitalConfig } from '../contracts/status'
import type { Recovery, Vital } from '../../domain/inventory/items'
import { ObservableStore } from './ObservableStore.ts'
import { UI_CONFIG } from '../../content/ui.ts'
import { scaleRecovery } from '../../domain/character/difficulty.ts'

function configuredStats(config: readonly VitalConfig[]) {
  const limits = {} as Record<Vital, number>
  const values = {} as Record<Vital, number>
  for (const defaults of UI_CONFIG.stats as VitalConfig[]) {
    const stat = config.find(entry => entry.id === defaults.id) ?? defaults
    limits[stat.id] = stat.max
    values[stat.id] = Math.max(0, Math.min(stat.max, stat.value))
  }
  if (values.sanity === 0) values.health = 0
  return { limits, values }
}

export class StatusService extends ObservableStore<StatusSnapshot> implements StatusController {
  private limits: StatusSnapshot
  private itemRecoveryMultiplier = 1
  private readonly damageResistance: () => number
  private readonly recoveryMultiplier: () => number
  constructor(config: readonly VitalConfig[] = UI_CONFIG.stats as VitalConfig[], recoveryMultiplier: () => number = () => 1, damageResistance: () => number = () => 0) {
    const initial = configuredStats(config)
    super(initial.values)
    this.limits = initial.limits
    this.damageResistance = damageResistance
    this.recoveryMultiplier = recoveryMultiplier
  }

  configure = (config: readonly VitalConfig[], itemRecoveryMultiplier: number): void => {
    const initial = configuredStats(config)
    this.limits = initial.limits
    this.itemRecoveryMultiplier = itemRecoveryMultiplier
    this.publishVitals(initial.values)
  }
  getLimits = (): Readonly<StatusSnapshot> => this.limits
  private publishVitals(next: StatusSnapshot): void {
    this.publish(next.sanity <= 0 ? { ...next, health: 0 } : next)
  }
  restoreState = (saved: StatusSnapshot): void => {
    this.publishVitals({ health: Math.min(saved.health, this.limits.health), energy: Math.min(saved.energy, this.limits.energy), sanity: Math.min(saved.sanity, this.limits.sanity) })
  }
  setLimits = (config: readonly VitalConfig[]): void => {
    const { limits } = configuredStats(config)
    if (Object.keys(limits).every(key => limits[key as Vital] === this.limits[key as Vital])) return
    this.limits = limits
    this.publishVitals({
      health: Math.min(this.snapshot.health, limits.health),
      energy: Math.min(this.snapshot.energy, limits.energy),
      sanity: Math.min(this.snapshot.sanity, limits.sanity),
    })
  }
  private itemEffects: { recovery(itemId: string, recovery: Recovery): Recovery; consumed(itemId: string, recovery: Recovery): void; canConsumeAtMaximum?(itemId: string): boolean } | undefined
  setItemEffects = (effects: NonNullable<StatusService['itemEffects']>): void => { this.itemEffects = effects }
  getItemRecovery = (recovery: Recovery, itemId?: string): Recovery => scaleRecovery(
    itemId ? this.itemEffects?.recovery(itemId, recovery) ?? recovery : recovery, this.itemRecoveryMultiplier)
  itemConsumed = (itemId: string, recovery: Recovery): void => { this.itemEffects?.consumed(itemId, recovery) }
  canConsumeAtMaximum = (): boolean => this.snapshot.health > 0 && this.snapshot.sanity > 0
  getRecovery = (recovery: Recovery): Recovery => scaleRecovery(recovery, this.recoveryMultiplier())

  takeDamage = (amount: number): void => {
    if (!Number.isFinite(amount) || amount <= 0 || this.snapshot.health === 0) return
    const resistance = this.damageResistance()
    amount *= 1 - (Number.isFinite(resistance) ? Math.max(0, Math.min(100, resistance)) : 0) / 100
    this.publishVitals({ ...this.snapshot, health: Math.max(0, this.snapshot.health - amount) })
  }

  drain = (amounts: Pick<Recovery, 'energy' | 'sanity'>): void => {
    const next = { ...this.snapshot }
    let changed = false
    for (const key of ['energy', 'sanity'] as const) {
      const amount = amounts[key] ?? 0
      if (!Number.isFinite(amount) || amount <= 0) continue
      next[key] = Math.max(0, next[key] - amount)
      if (next[key] !== this.snapshot[key]) changed = true
    }
    if (changed) this.publishVitals(next)
  }

  recover = (recovery: Recovery): boolean => {
    if (this.snapshot.sanity <= 0) return false
    recovery = this.getRecovery(recovery)
    const next = { ...this.snapshot }
    let changed = false
    for (const key of ['health', 'energy', 'sanity'] as Vital[]) {
      const amount = recovery[key] ?? 0
      if (!Number.isFinite(amount) || amount <= 0) continue
      next[key] = Math.min(this.limits[key], next[key] + amount)
      if (next[key] !== this.snapshot[key]) changed = true
    }
    if (changed) this.publishVitals(next)
    return changed
  }
}
