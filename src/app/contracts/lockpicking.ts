import type { LockNumbers } from '../../domain/buildings/lockpicking'
import type { ItemRarity } from '../../domain/inventory/items'

export interface LockPuzzle { readonly doorId: string; readonly name: string; readonly target: number; readonly deadline: number; readonly numbers: LockNumbers; readonly failed: boolean }
export interface LockpickingController {
  getSnapshot(): { readonly puzzle: LockPuzzle | null }
  subscribe(listener: () => void): () => void
  isLocked(doorId: string, roomId?: string): boolean
  attempt(doorId: string, name: string, roomId?: string): boolean
  attemptContainer(containerId: string, name: string, onUnlocked: () => void, rarity?: ItemRarity): void
  setNumber(index: number, value: number): void
  submit(): void
  tick(): void
  close(): void
}
