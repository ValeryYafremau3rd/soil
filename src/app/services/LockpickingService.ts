import { legendarySkill } from '../../domain/skills/effects.ts'
import type { LockpickingController, LockPuzzle } from '../contracts/lockpicking'
import type { DayTimeController } from '../contracts/daytime'
import type { LockpickingConfig, LockNumbers } from '../../domain/buildings/lockpicking'
import { doorLocked, lockDuration, matchesLock, rollLockTarget } from '../../domain/buildings/lockpicking.ts'
import type { ItemRarity } from '../../domain/inventory/items'
import { ObservableStore } from './ObservableStore.ts'
import type { MessageController } from '../contracts/messages'

export class LockpickingService extends ObservableStore<{ puzzle: LockPuzzle | null }> implements LockpickingController {
  private readonly time: DayTimeController
  private readonly skill: () => number
  private readonly config: LockpickingConfig
  private readonly now: () => number
  private readonly random: () => number
  private readonly unlocked = new Set<string>()
  private onUnlocked?: () => void
  private readonly supply: { has(): boolean; consume(): boolean; canUse?(): boolean }
  private readonly notify: MessageController['show']
  onLockType: (kind: 'container' | 'door') => void = () => {}
  private readonly onPicked: () => void
  private readonly hasDoorKey: (id: string) => boolean
  constructor(time: DayTimeController, skill: () => number, config: LockpickingConfig, supply: { has(): boolean; consume(): boolean; canUse?(): boolean }, now = Date.now, random = Math.random, notify: MessageController['show'] = () => {}, hasDoorKey: (id: string) => boolean = () => false, onPicked: () => void = () => {}) {
    super({ puzzle: null })
    this.notify = notify
    this.onPicked = onPicked
    this.hasDoorKey = hasDoorKey
    this.supply = supply
    this.time = time; this.skill = skill; this.config = config; this.now = now; this.random = random
  }
  private key = (id: string): string => `${this.time.getSnapshot().day}:${id}`
  saveState = (): readonly string[] => [...this.unlocked]
  restoreState = (unlocked: readonly string[]): void => { this.unlocked.clear(); for (const id of unlocked) this.unlocked.add(id) }
  isLocked = (id: string, roomId?: string): boolean => doorLocked(this.time.getSnapshot().phase === 'night', roomId)
    && !this.hasDoorKey(id) && !this.unlocked.has(this.key(id))
  attempt = (id: string, name: string, roomId?: string): boolean => {
    if (!this.isLocked(id, roomId)) return true
    this.startAttempt(id, name)
    return false
  }
  attemptContainer = (id: string, name: string, onUnlocked: () => void, rarity: ItemRarity = 'common'): void => {
    this.startAttempt(`container:${id}`, name, onUnlocked, rarity)
  }
  private startAttempt(id: string, name: string, onUnlocked?: () => void, rarity: ItemRarity = 'common'): void {
    if (this.snapshot.puzzle) return
    if (!legendarySkill({ lockpicking: this.skill() }, 'lockpicking') && !this.supply.has()) {
      this.notify('A lockpick is required to pick this lock.')
      return
    }
    if (!legendarySkill({ lockpicking: this.skill() }, 'lockpicking') && this.supply.canUse && !this.supply.canUse()) return
    if (!this.snapshot.puzzle) {
      const target = rollLockTarget(rarity, this.config, this.random)
      const digit = () => 1 + Math.floor(this.random() * 9)
      const numbers: [number, number, number] = [digit(), digit(), digit()]
      // Keep every attempt unsolved without retrying random draws indefinitely.
      if (matchesLock(numbers, target)) numbers[0] = numbers[0] % 9 + 1
      this.onUnlocked = onUnlocked
      this.publish({ puzzle: { doorId: id, name, target, numbers,
        deadline: this.now() + lockDuration(this.skill(), this.config), failed: false } })
    }
  }
  setNumber = (index: number, value: number): void => {
    this.tick()
    const puzzle = this.snapshot.puzzle
    if (!puzzle || puzzle.failed || !Number.isInteger(index) || index < 0 || index > 2 || !Number.isInteger(value) || value < 1 || value > 9) return
    const numbers = [...puzzle.numbers] as [number, number, number]
    numbers[index] = value
    this.publish({ ...this.snapshot, puzzle: { ...puzzle, numbers: numbers as LockNumbers } })
  }
  submit = (): void => {
    this.tick()
    const puzzle = this.snapshot.puzzle
    if (!puzzle || puzzle.failed) return
    if (!matchesLock(puzzle.numbers, puzzle.target)) { this.close(); return }
    if (!legendarySkill({ lockpicking: this.skill() }, 'lockpicking') && (!this.supply.has() || this.supply.canUse && !this.supply.canUse())) { this.close(); return }
    const onUnlocked = this.onUnlocked
    this.onUnlocked = undefined
    if (onUnlocked) onUnlocked()
    else this.unlocked.add(this.key(puzzle.doorId))
    this.publish({ puzzle: null })
    this.onLockType(onUnlocked ? 'container' : 'door')
    this.onPicked()
    this.notify(`Lockpicking successful: ${puzzle.name} unlocked.`, 'success')
  }
  tick = (): void => {
    const puzzle = this.snapshot.puzzle
    if (puzzle && this.now() >= puzzle.deadline) this.close()
  }
  close = (): void => {
    if (!this.snapshot.puzzle) return
    this.onUnlocked = undefined
    this.publish({ puzzle: null })
    const free = legendarySkill({ lockpicking: this.skill() }, 'lockpicking')
    if (!free) this.supply.consume()
    this.notify(free ? 'Lockpicking failed.' : 'Lockpicking failed. One lockpick broke.')
  }
}
