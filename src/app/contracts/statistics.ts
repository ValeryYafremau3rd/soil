export const STATISTICS = {
  distance: 'Distance travelled (world pixels)',
  jumps: 'Jumps',
  damageDealt: 'Damage dealt',
  damageTaken: 'Damage taken',
  meleeAttacks: 'Melee attacks',
  shots: 'Shots fired',
  moneySpent: 'Money spent',
  moneyEarned: 'Money earned',
  itemsBought: 'Items bought',
  itemsSold: 'Items sold',
  itemsLooted: 'Items looted',
  itemsScrapped: 'Items scrapped',
  itemsConsumed: 'Items consumed',
  alcoholDrunk: 'Alcoholic drinks consumed',
  cigarettesSmoked: 'Cigarettes smoked',
  locksPicked: 'Locks picked',
  containersLockpicked: 'Containers lockpicked',
  doorsLockpicked: 'Doors lockpicked',
  questsCompleted: 'Quests completed',
  dialogueChoices: 'Dialogue choices',
  persuaded: 'Persuasions',
  intimidated: 'Intimidations',
  adviceAsked: 'Advice requested',
  policeKilled: 'Police defeated',
  monstersKilled: 'Monsters defeated',
  trips: 'Journeys completed',
  rests: 'Rests',
  sleeps: 'Sleeps',
} as const
export type Statistic = keyof typeof STATISTICS
// Movement and resisted damage retain precision; discrete actions count whole units.
export const FRACTIONAL_STATISTICS: readonly Statistic[] = ['distance', 'damageDealt', 'damageTaken']
export type StatisticsSnapshot = Readonly<Partial<Record<Statistic, number>>>
/**
 * Typed statistics actions and queries exposed across application layers.
 */
export interface StatisticsController {
  getSnapshot(): StatisticsSnapshot
  subscribe(listener: () => void): () => void
  record(statistic: Statistic, amount?: number): void
}
