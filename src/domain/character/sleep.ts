export interface SleepSettings { gracePhases: number; sanityPerPhase: number }
export function advanceSleepDebt(awakePhases: number, elapsed: number, sleeping: boolean, settings: SleepSettings): { awakePhases: number; damage: number } {
  if (sleeping) return { awakePhases: 0, damage: 0 }
  const next = awakePhases + Math.max(0, elapsed)
  const overdue = Math.max(0, next - settings.gracePhases) - Math.max(0, awakePhases - settings.gracePhases)
  return { awakePhases: next, damage: overdue * settings.sanityPerPhase }
}
