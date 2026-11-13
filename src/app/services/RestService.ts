import type { DayTimeController } from '../contracts/daytime'
import { DAY_PHASES } from '../contracts/daytime.ts'
import type { RestController, RestKind, RestSnapshot } from '../contracts/rest'
import { ObservableStore } from './ObservableStore.ts'
import type { StatusController } from '../contracts/status'
import { StatusService } from './StatusService.ts'
import type { Recovery } from '../../domain/inventory/items'
import { UI_CONFIG } from '../../content/ui.ts'
import type { LoadingController } from '../contracts/loading'

const defaultRecovery = (kind: RestKind): Recovery => ({
  health: UI_CONFIG.rest.healthRecovery[kind],
  energy: UI_CONFIG.rest.energyRecovery[kind],
  sanity: UI_CONFIG.rest.sanityRecovery[kind],
})

export class RestService extends ObservableStore<RestSnapshot> implements RestController {
  private advancingTime = false
  private sleeping = false
  get isAdvancingTime(): boolean { return this.advancingTime }
  get isSleeping(): boolean { return this.sleeping }
  private readonly time: Pick<DayTimeController, 'advance' | 'nextMorning'> & Partial<Pick<DayTimeController, 'getSnapshot'>>
  private readonly status: Pick<StatusController, 'recover'> & Partial<Pick<StatusController, 'getRecovery' | 'getLimits'>>
  private recovery: Readonly<Record<RestKind, Recovery | number>>
  private readonly onSlept: () => void
  private readonly loading?: LoadingController
  private pending = false
  private restBlocked = false
  constructor(time: RestService['time'],
    status: RestService['status'] = new StatusService(), recovery: Readonly<Record<RestKind, Recovery | number>> = { rest: defaultRecovery('rest'), sleep: defaultRecovery('sleep') },
    onSlept: () => void = () => {}, loading?: LoadingController) {
    super({ menu: null }); this.time = time; this.status = status; this.recovery = recovery
    this.onSlept = onSlept
    this.loading = loading
  }
  configure = (recovery: Readonly<Record<RestKind, Recovery>>): void => { this.recovery = recovery }
  private baseRecovery = (kind: RestKind): Recovery => {
    const recovery = this.recovery[kind]
    if (kind === 'sleep' && typeof recovery !== 'number') {
      const limits = this.status.getLimits?.() ?? { health: 100, energy: 100, sanity: 100 }
      return Object.fromEntries(Object.entries(recovery).map(([vital, percent]) =>
        [vital, limits[vital as keyof typeof limits] * percent / 100]))
    }
    return { energy: typeof recovery === 'number' ? recovery : recovery.energy ?? 0 }
  }
  getRecovery = (kind: RestKind): Recovery => {
    const recovery = this.baseRecovery(kind)
    return this.status.getRecovery?.(recovery) ?? recovery
  }
  open = (kind: RestKind, name: string): void => {
    if (this.restBlocked) return
    if (!this.pending && (!this.loading || this.loading.getSnapshot().phase === 'idle') && !this.snapshot.menu) this.publish({ menu: { kind, name } })
  }
  close = (): void => { if (this.snapshot.menu) this.publish({ menu: null }) }
  setCombatActive = (active: boolean, fearAuraActive = false): void => {
    this.restBlocked = active || fearAuraActive
    if (this.restBlocked) this.close()
  }
  confirm = (phases?: number): void => {
    const menu = this.snapshot.menu
    if (!menu || this.restBlocked) return
    if (phases !== undefined && (!Number.isInteger(phases) || phases < 1 || phases > 4)) return
    const loading = this.loading
    if (loading && !loading.begin(menu.kind === 'sleep' ? 'Sleeping…' : 'Resting…')) return
    this.pending = true
    this.close()
    if (loading) {
      setTimeout(() => {
        loading.covered()
        try { this.complete(menu.kind, phases) }
        finally {
          setTimeout(() => {
            loading.ready()
            setTimeout(() => { loading.finish(); this.pending = false }, loading.fadeMs)
          }, loading.fadeMs * 2)
        }
      }, loading.fadeMs)
    } else {
      try { this.complete(menu.kind, phases) } finally { this.pending = false }
    }
  }
  onCompleted: (kind: RestKind) => void = () => {}
  private complete = (kind: RestKind, phases?: number): void => {
    if (this.restBlocked) return
    const ticks = kind === 'sleep' && typeof this.recovery[kind] !== 'number'
      ? phases ?? DAY_PHASES.length - DAY_PHASES.indexOf(this.time.getSnapshot?.().phase ?? 'night') : 1
    const recovery = this.baseRecovery(kind)
    // Recover each tick separately so Medicine rounding and vital caps apply per tick.
    for (let tick = 0; tick < ticks; tick++) this.status.recover(recovery)
    this.advancingTime = true
    this.sleeping = kind === 'sleep'
    try {
      if (phases !== undefined) {
        for (let i = 0; i < phases; i++) this.time.advance()
      } else if (kind === 'sleep') this.time.nextMorning()
      else this.time.advance()
    } finally { this.advancingTime = false; this.sleeping = false }
    this.onCompleted(kind)
    if (kind === 'sleep') this.onSlept()
  }
}
