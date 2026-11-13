import { requireCondition,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validatePerks(context: ContentContext) {
  const { items, perks, buffs } = context
unique([...perks, ...buffs].map(entry => entry.id), 'ui.perks and ui.consumableBuffs')
for (const buff of buffs) {
    requireCondition(buff.amount !== 0 && (buff.attribute !== undefined || buff.amount > 0), `ui.consumableBuffs.${buff.id}: invalid amount`)
    if (buff.attribute) requireCondition(Math.abs(buff.amount) <= 3, `ui.consumableBuffs.${buff.id}: attribute bonus must not exceed 3`)
    requireCondition([Boolean(buff.attribute), Boolean(buff.vital), buff.damageResistance === true, buff.fearResistance === true].filter(Boolean).length === 1, `ui.consumableBuffs.${buff.id}: requires exactly one attribute, vital or resistance`)
    requireCondition(!buff.fearResistance || buff.amount <= 100, `ui.consumableBuffs.${buff.id}: resistance must not exceed 100`)
    requireCondition(!buff.damageResistance || buff.amount <= 30, `ui.consumableBuffs.${buff.id}: damage resistance must not exceed 30`)
    unique(buff.itemIds, `ui.consumableBuffs.${buff.id}.itemIds`)
    for (const id of buff.itemIds) requireCondition(items.some(item => item.id === id && item.consumable && item.recovery), `ui.consumableBuffs.${buff.id}: invalid consumable ${id}`)
  }
for (const perk of perks) {
    requireCondition(perk.actionPoints ? !perk.itemIds.length && Object.keys(perk.actionPoints).length > 0 : perk.itemIds.length > 0, `ui.perks.${perk.id}: requires actions or consumable items`)
    unique(perk.itemIds, `ui.perks.${perk.id}.itemIds`)
    for (const id of perk.itemIds) requireCondition(items.some(item => item.id === id && item.consumable && (item.recovery?.sanity ?? 0) > 0), `ui.perks.${perk.id}: invalid consumable ${id}`)
  }
}
