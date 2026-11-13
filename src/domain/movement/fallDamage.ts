import type { VerticalState } from './platforms'

export interface FallDamageSettings { safeHeight: number; damagePerPixel: number }

export function fallDamage(distance: number, settings: FallDamageSettings): number {
  if (!Number.isFinite(distance) || distance <= settings.safeHeight) return 0
  return Math.ceil((distance - settings.safeHeight) * settings.damagePerPixel)
}

/** Measure each uninterrupted drop from its highest point, resolving it once on landing. */
export class FallTracker {
  private highestY?: number
  private readonly settings: FallDamageSettings

  constructor(settings: FallDamageSettings) { this.settings = settings }
  reset(): void { this.highestY = undefined }

  update(previous: VerticalState, current: VerticalState): number {
    if (previous.grounded && current.grounded) { this.reset(); return 0 }
    this.highestY = Math.min(this.highestY ?? previous.y, previous.y, current.y)
    if (!current.grounded) return 0
    const damage = fallDamage(current.y - this.highestY, this.settings)
    this.reset()
    return damage
  }
}
