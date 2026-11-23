import type { StatusController, StatusSnapshot, VitalConfig } from '../../contracts/status'
import type { Recovery, Vital } from '../../../domain/inventory/items'
import { ObservableStore } from '../core/ObservableStore.ts'
import { UI_CONFIG } from '../../../content/ui.ts'
import { scaleRecovery } from '../../../domain/character/difficulty.ts'

/**
 * Perform configured stats.
 * @param {readonly AttributeVitalConfig[]} config - Configuration consumed by this operation.
 * @returns {{ limits: Record<Vital, number>; values: Record<Vital, number>; }} The result described by the TypeScript return signature.
 */
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

/**
 * Owns status service state and behavior.
 */
export class StatusService extends ObservableStore<StatusSnapshot> implements StatusController {
  private limits: StatusSnapshot
  private itemRecoveryMultiplier = 1
  private readonly damageResistance: () => number
  private readonly recoveryMultiplier: () => number

  /**
   * Initialize the StatusService instance and its collaborators.
   * @param {readonly AttributeVitalConfig[]} config - Configuration consumed by this operation.
   * @param {() => number} recoveryMultiplier - The recovery multiplier supplied to this operation.
   * @param {() => number} damageResistance - The damage resistance supplied to this operation.
   * @returns {StatusService} The initialized instance.
   */
  constructor(
    config: readonly VitalConfig[] = UI_CONFIG.stats as VitalConfig[],
    recoveryMultiplier: () => number = () => 1,
    damageResistance: () => number = () => 0
  ) {
    const initial = configuredStats(config)
    super(initial.values)
    this.limits = initial.limits
    this.damageResistance = damageResistance
    this.recoveryMultiplier = recoveryMultiplier
  }

  /**
   * Perform configure for StatusService.
   * @param {readonly AttributeVitalConfig[]} config - Configuration consumed by this operation.
   * @param {number} itemRecoveryMultiplier - The item recovery multiplier supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  configure = (config: readonly VitalConfig[], itemRecoveryMultiplier: number): void => {
    const initial = configuredStats(config)
    this.limits = initial.limits
    this.itemRecoveryMultiplier = itemRecoveryMultiplier
    this.publishVitals(initial.values)
  }

  /**
   * Read limits.
   * @returns {Readonly<StatusSnapshot>} The result described by the TypeScript return signature.
   */
  getLimits = (): Readonly<StatusSnapshot> => this.limits

  /**
   * Perform publish vitals for StatusService.
   * @param {StatusSnapshot} next - The next supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private publishVitals(next: StatusSnapshot): void {
    this.publish(next.sanity <= 0 ? { ...next, health: 0 } : next)
  }

  /**
   * Restore state.
   * @param {StatusSnapshot} saved - The saved supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  restoreState = (saved: StatusSnapshot): void => {
    this.publishVitals({
      health: Math.min(saved.health, this.limits.health),
      energy: Math.min(saved.energy, this.limits.energy),
      sanity: Math.min(saved.sanity, this.limits.sanity)
    })
  }

  /**
   * Set limits.
   * @param {readonly AttributeVitalConfig[]} config - Configuration consumed by this operation.
   * @returns {void} Completes the operation without returning a value.
   */
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
  private itemEffects:
    {
      recovery(itemId: string, recovery: Recovery): Recovery
      consumed(itemId: string, recovery: Recovery): void
      canConsumeAtMaximum?(itemId: string): boolean
    } |
    undefined

  /**
   * Set item effects.
   * @param {object} effects - The effects supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  setItemEffects = (effects: NonNullable<StatusService['itemEffects']>): void => {
    this.itemEffects = effects
  }

  /**
   * Read item recovery.
   * @param {Partial<Record<Vital, number>>} recovery - The recovery supplied to this operation.
   * @param {string | undefined} itemId - Identifier of the item being processed.
   * @returns {Partial<Record<Vital, number>>} The result described by the TypeScript return signature.
   */
  getItemRecovery = (
    recovery: Recovery,
    itemId?: string
  ): Recovery => scaleRecovery(
    itemId ? this.itemEffects?.recovery(itemId, recovery) ?? recovery : recovery,
    this.itemRecoveryMultiplier
  )

  /**
   * Perform item consumed for StatusService.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {Partial<Record<Vital, number>>} recovery - The recovery supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  itemConsumed = (
    itemId: string,
    recovery: Recovery
  ): void => {
    this.itemEffects?.consumed(itemId, recovery)
  }

  /**
   * Check whether consume at maximum is allowed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canConsumeAtMaximum = (): boolean => this.snapshot.health > 0 && this.snapshot.sanity > 0

  /**
   * Read recovery.
   * @param {Partial<Record<Vital, number>>} recovery - The recovery supplied to this operation.
   * @returns {Partial<Record<Vital, number>>} The result described by the TypeScript return signature.
   */
  getRecovery = (recovery: Recovery): Recovery => scaleRecovery(recovery, this.recoveryMultiplier())

  /**
   * Perform take damage for StatusService.
   * @param {number} amount - Amount to apply to the operation.
   * @returns {void} Completes the operation without returning a value.
   */
  takeDamage = (amount: number): void => {
    if (!Number.isFinite(amount) || amount <= 0 || this.snapshot.health === 0) return

    const resistance = this.damageResistance()
    amount *= 1 - (Number.isFinite(resistance) ? Math.max(0, Math.min(100, resistance)) : 0) / 100
    this.publishVitals({ ...this.snapshot, health: Math.max(0, this.snapshot.health - amount) })
  }

  /**
   * Perform drain for StatusService.
   * @param {Pick<Partial<Record<Vital, number>>, "energy" | "sanity">} amounts - The amounts supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
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

  /**
   * Perform recover for StatusService.
   * @param {Partial<Record<Vital, number>>} recovery - The recovery supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
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
