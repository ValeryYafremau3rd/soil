/**
 * Actor capabilities required to select and resolve combat interactions.
 */
interface Combatant {
  kind: 'human' | 'monster'
  health: number
  detectionRadius: number
  sprite: {
    x: number
    y: number
    visible: boolean
    active: boolean
  }
}

/**
 * Humans cooperate against monsters; only living opponents in the current context qualify.
 * @param {T} source - Source data or actor used by this operation.
 * @param {readonly T[]} candidates - The candidates supplied to this operation.
 * @returns {T | undefined} The result described by the TypeScript return signature.
 */
export function nearestPatrolEnemy<T extends Combatant>(
  source: T,
  candidates: readonly T[]
): T | undefined {
  if (source.health <= 0) return undefined

  let nearest: T | undefined
  let distance = source.detectionRadius

  for (const candidate of candidates) {
    if (candidate.kind === source.kind || candidate.health <= 0 || !candidate.sprite.visible || !candidate.sprite.active) continue

    const separation = Math.hypot(candidate.sprite.x - source.sprite.x, candidate.sprite.y - source.sprite.y)
    if (separation <= distance) {
      nearest = candidate
      distance = separation
    }
  }

  return nearest
}
