import type { Attributes } from './character'
import type { Vital } from '../inventory/items'

export interface AttributeVitalConfig {
  id: Vital
  value: number
  max: number
  attributeBonuses?: readonly { attribute: keyof Attributes; pointsPerAttribute: number }[]
}

/** Apply flat attribute points after difficulty; equipment changes only reuse the caps. */
export function attributeVitals<T extends AttributeVitalConfig>(stats: readonly T[], attributes: Readonly<Attributes>): T[] {
  return stats.map(stat => {
    const bonus = (stat.attributeBonuses ?? []).reduce((total, entry) =>
      total + Math.max(0, attributes[entry.attribute]) * entry.pointsPerAttribute, 0)
    return { ...stat, value: stat.value + bonus, max: stat.max + bonus }
  })
}
