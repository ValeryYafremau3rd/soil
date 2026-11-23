/**
 * Authored sleep recovery and time progression settings.
 */
export interface SleepSettings {
  gracePhases: number
  sanityPerPhase: number
}

/**
 * Perform advance sleep debt.
 * @param {number} awakePhases - The awake phases supplied to this operation.
 * @param {number} elapsed - The elapsed supplied to this operation.
 * @param {boolean} sleeping - The sleeping supplied to this operation.
 * @param {SleepSettings} settings - Configuration values for this instance.
 * @returns {{ awakePhases: number; damage: number; }} The result described by the TypeScript return signature.
 */
export function advanceSleepDebt(
  awakePhases: number,
  elapsed: number,
  sleeping: boolean,
  settings: SleepSettings
): {
  awakePhases: number
  damage: number
} {
  if (sleeping) return { awakePhases: 0, damage: 0 }

  const next = awakePhases + Math.max(0, elapsed)
  const overdue = Math.max(0, next - settings.gracePhases) - Math.max(0, awakePhases - settings.gracePhases)

  return { awakePhases: next, damage: overdue * settings.sanityPerPhase }
}
