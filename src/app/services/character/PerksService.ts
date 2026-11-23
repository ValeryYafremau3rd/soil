import { scaleItemBuff } from '../../../domain/skills/effects.ts'
import { ObservableStore } from '../core/ObservableStore.ts'
import {
  progressForAction,
  consumeForBuffs,
  consumeForPerks,
  emptyPerks,
  expirePerks,
  perkRecovery,
  perkWithdrawal,
  normalizeConsumableGroups
} from '../../../domain/character/perks.ts'
import type { ConsumableBuffDefinition, PerkAction, PerkDefinition, PerksSnapshot } from '../../../domain/character/perks'
import type { Recovery } from '../../../domain/inventory/items'
import type { DayTimeController } from '../../contracts/daytime'
import { DAY_PHASES } from '../../contracts/daytime.ts'
import type { StatusController } from '../../contracts/status'

/**
 * Owns perks service state and behavior.
 */
export class PerksService extends ObservableStore<PerksSnapshot> {
  readonly definitions: readonly PerkDefinition[]
  readonly buffDefinitions: readonly ConsumableBuffDefinition[]
  private readonly time: DayTimeController

  /**
   * Initialize the PerksService instance and its collaborators.
   * @param {readonly PerkDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
   * @param {DayTimeController} time - The time supplied to this operation.
   * @param {Pick<StatusController, "drain">} status - The status supplied to this operation.
   * @param {PerksSnapshot} saved - The saved supplied to this operation.
   * @param {(message: string) => void} notify - Callback for presenting an operation message.
   * @param {readonly ConsumableBuffDefinition[]} buffDefinitions - The buff definitions supplied to this operation.
   * @param {() => number} itemMultiplier - The item multiplier supplied to this operation.
   * @param {() => boolean} medicineProtection - The medicine protection supplied to this operation.
   * @returns {PerksService} The initialized instance.
   */
  constructor(
    definitions: readonly PerkDefinition[],
    time: DayTimeController,
    status: Pick<StatusController, 'drain'>,
    saved = emptyPerks(),
    notify: (message: string) => void = () => { },
    buffDefinitions: readonly ConsumableBuffDefinition[] = [],
    itemMultiplier: () => number = () => 1,
    medicineProtection: () => boolean = () => false
  ) {
    const now = time.getSnapshot()
    super(normalizeConsumableGroups(
      expirePerks(
        saved,
        definitions,
        (now.day - 1) * DAY_PHASES.length + DAY_PHASES.indexOf(now.phase),
        DAY_PHASES.length
      ),
      buffDefinitions
    ))
    this.medicineProtection = medicineProtection
    this.itemMultiplier = itemMultiplier
    this.definitions = definitions
    this.buffDefinitions = buffDefinitions
    this.time = time
    time.subscribe(() => {
      const state = expirePerks(this.snapshot, definitions, this.tick(), DAY_PHASES.length)
      const result = perkWithdrawal(state, definitions, this.tick(), DAY_PHASES.length)
      this.publish(result.state)
      if (result.sanity > 0 && !this.medicineProtection()) status.drain({ sanity: result.sanity })
    })
    this.notify = notify
  }
  private readonly medicineProtection: () => boolean
  private readonly itemMultiplier: () => number
  private readonly notify: (message: string) => void

  /**
   * Perform tick for PerksService.
   * @returns {number} The calculated numeric result.
   */
  private tick = (): number => {
    const time = this.time.getSnapshot()

    return (time.day - 1) * DAY_PHASES.length + DAY_PHASES.indexOf(time.phase)
  }

  /**
   * Perform on action for PerksService.
   * @returns {void} Completes the operation without returning a value.
   */
  onAction: (action: PerkAction) => void = () => { }

  /**
   * Perform on consumed for PerksService.
   * @returns {void} Completes the operation without returning a value.
   */
  onConsumed: (itemId: string) => void = () => { }

  /**
   * Perform record action for PerksService.
   * @param {object} action - The action supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  recordAction = (action: PerkAction): void => {
    this.onAction(action)
    const next = progressForAction(this.snapshot, this.definitions, action)
    if (next === this.snapshot) return

    const gained = next.acquired.filter(id => !this.snapshot.acquired.includes(id))
    this.publish(next)

    for (const id of gained) this.notify('Perk acquired: ' + this.definitions.find(perk => perk.id === id)!.name)
  }

  /**
   * Perform recovery for PerksService.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {Partial<Record<Vital, number>>} recovery - The recovery supplied to this operation.
   * @returns {Partial<Record<Vital, number>>} The result described by the TypeScript return signature.
   */
  recovery = (
    itemId: string,
    recovery: Recovery
  ): Recovery => Object.fromEntries(Object.entries(perkRecovery(this.snapshot, this.definitions, itemId, recovery)).map(([key, amount]) => [key, scaleItemBuff(amount, this.itemMultiplier())]))

  /**
   * Clear timed effects.
   * @returns {void} Completes the operation without returning a value.
   */
  clearTimedEffects = (): void => {
    this.publish({ ...this.snapshot, buffs: [] })
  }

  /**
   * Check whether consume at maximum is allowed.
   * @param {string} itemId - Identifier of the item being processed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canConsumeAtMaximum = (itemId: string): boolean => this.definitions.some(perk => perk.consumeAtMaximum && perk.itemIds.includes(itemId))
    || this.buffDefinitions.some(buff => buff.itemIds.includes(itemId))

  /**
   * Perform consumed for PerksService.
   * @param {string} itemId - Identifier of the item being processed.
   * @param {Partial<Record<Vital, number>>} recovery - The recovery supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  consumed = (
    itemId: string,
    recovery: Recovery
  ): void => {
    this.onConsumed(itemId)
    const next = consumeForBuffs(
      consumeForPerks(
        this.snapshot,
        this.definitions,
        itemId,
        recovery.sanity ?? 0,
        this.tick()
      ),
      this.buffDefinitions,
      itemId,
      this.tick(),
      DAY_PHASES.length
    )
    const gained = next.acquired.filter(id => !this.snapshot.acquired.includes(id))
    this.publish(next)

    for (const id of gained) this.notify(`Perk acquired: ${this.definitions.find(perk => perk.id === id)!.name}`)
  }
}
