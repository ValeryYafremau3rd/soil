export const DAY_PHASES = ['morning', 'afternoon', 'evening', 'night'] as const
export type DayPhase = typeof DAY_PHASES[number]

export interface DayTimeSnapshot { readonly day: number; readonly phase: DayPhase; readonly weather?: import('../../domain/character/weather').Weather }
export interface DayTimeController {
  getSnapshot(): DayTimeSnapshot
  subscribe(listener: () => void): () => void
  advance(): void
  nextMorning(): void
}
