import { scaleItemBuff } from '../../domain/skills/effects.ts'
import { ObservableStore } from './ObservableStore.ts'
import { progressForAction, consumeForBuffs, consumeForPerks, emptyPerks, expirePerks, perkRecovery, perkWithdrawal, normalizeConsumableGroups } from '../../domain/character/perks.ts'
import type { ConsumableBuffDefinition, PerkAction, PerkDefinition, PerksSnapshot } from '../../domain/character/perks'
import type { Recovery } from '../../domain/inventory/items'
import type { DayTimeController } from '../contracts/daytime'
import { DAY_PHASES } from '../contracts/daytime.ts'
import type { StatusController } from '../contracts/status'

export class PerksService extends ObservableStore<PerksSnapshot> {
  readonly definitions: readonly PerkDefinition[]
  readonly buffDefinitions: readonly ConsumableBuffDefinition[]
  private readonly time: DayTimeController
  constructor(definitions: readonly PerkDefinition[], time: DayTimeController, status: Pick<StatusController, 'drain'>,
    saved = emptyPerks(), notify: (message: string) => void = () => {}, buffDefinitions: readonly ConsumableBuffDefinition[] = [], itemMultiplier: () => number = () => 1, medicineProtection: () => boolean = () => false) {
    const now = time.getSnapshot()
    super(normalizeConsumableGroups(expirePerks(saved, definitions, (now.day - 1) * DAY_PHASES.length + DAY_PHASES.indexOf(now.phase), DAY_PHASES.length), buffDefinitions))
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
  private tick = (): number => {
    const time = this.time.getSnapshot()
    return (time.day - 1) * DAY_PHASES.length + DAY_PHASES.indexOf(time.phase)
  }
  onAction: (action: PerkAction) => void = () => {}
  onConsumed: (itemId: string) => void = () => {}
  recordAction = (action: PerkAction): void => {
    this.onAction(action)
    const next = progressForAction(this.snapshot, this.definitions, action)
    if (next === this.snapshot) return
    const gained = next.acquired.filter(id => !this.snapshot.acquired.includes(id))
    this.publish(next)
    for (const id of gained) this.notify('Perk acquired: ' + this.definitions.find(perk => perk.id === id)!.name)
  }
  recovery = (itemId: string, recovery: Recovery): Recovery => Object.fromEntries(Object.entries(perkRecovery(this.snapshot, this.definitions, itemId, recovery)).map(([key, amount]) => [key, scaleItemBuff(amount, this.itemMultiplier())]))
  clearTimedEffects = (): void => { this.publish({ ...this.snapshot, buffs: [] }) }
  canConsumeAtMaximum = (itemId: string): boolean => this.definitions.some(perk => perk.consumeAtMaximum && perk.itemIds.includes(itemId))
    || this.buffDefinitions.some(buff => buff.itemIds.includes(itemId))
  consumed = (itemId: string, recovery: Recovery): void => {
    this.onConsumed(itemId)
    const next = consumeForBuffs(consumeForPerks(this.snapshot, this.definitions, itemId, recovery.sanity ?? 0, this.tick()),
      this.buffDefinitions, itemId, this.tick(), DAY_PHASES.length)
    const gained = next.acquired.filter(id => !this.snapshot.acquired.includes(id))
    this.publish(next)
    for (const id of gained) this.notify(`Perk acquired: ${this.definitions.find(perk => perk.id === id)!.name}`)
  }
}
