import { itemBonuses } from '../../../domain/inventory/items.ts'
import { requireCondition, unique } from './assertions.ts'
import type { ContentContext } from './context.ts'

/**
 * Validate items against the supported rules.
 * @param {object} context - The context supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateItems(context: ContentContext) {
  const { items, buffs, ui } = context

  for (const item of items) {
    if (item.readable) requireCondition(
      item.category === 'Book' && item.consumable === true
      && !item.equipmentSlot && !item.recovery && !item.scrap && itemBonuses(item).length > 0
      && itemBonuses(item).every(bonus => 'skill' in bonus),
      `items.json.${item.id}.readable: requires a consumable book with permanent skill bonuses only`
    )

    if (item.equipmentSlot === 'amulet') requireCondition(item.fearResistance !== undefined,
      `items.json.${item.id}.fearResistance: required for amulets`)
    // Weapon identity is independent of its RPG bonuses (e.g. a stealth knife).
    const weapon = item.firearm || item.equipmentSlot === 'melee'
      || ['Weapon', 'Tool'].includes(item.category) && itemBonuses(item).some(bonus => 'skill' in bonus && bonus.skill === 'martialArts')
    requireCondition(
      weapon ? item.damageMultiplier !== undefined : item.damageMultiplier === undefined,
      `items.json.${item.id}.damageMultiplier: required only for weapons`
    )
    const bonusTargets = itemBonuses(item).map(bonus => 'attribute' in bonus ? `attribute:${bonus.attribute}` : `skill:${bonus.skill}`)
    unique(bonusTargets, `items.json.${item.id}.bonuses`)
    if (item.requirementMode === 'any') requireCondition(item.skillRequirements && Object.keys(item.skillRequirements).length > 0,
      `items.json.${item.id}.requirementMode: requires at least one alternative skill`)

    if (item.requirementMode === 'any') requireCondition(
      Object.values(item.skillRequirements ?? {}).every(required => item.eruditionRequired! > required!),
      `items.json.${item.id}.eruditionRequired: education must exceed every alternative skill requirement`
    )

    if (item.stealthModifier !== undefined) requireCondition(item.category === 'Clothing' && item.stealthModifier !== 0,
      `items.json.${item.id}.stealthModifier: requires clothing and a nonzero modifier`)

    if (item.attachToKeyRing) requireCondition(
      item.id !== 'key-ring' && item.keys?.length && item.saleable === false
      && items.some(candidate => candidate.id === 'key-ring' && candidate.keys?.length),
      `items.json.${item.id}.attachToKeyRing: requires protected keys and a key ring`
    )

    if (item.inventorySlots) requireCondition(
      !item.consumable && (item.maxStack ?? 1) === 1,
      `items.json.${item.id}.inventorySlots: requires a non-stackable, nonconsumable bag`
    )

    if (item.iconClip) requireCondition(
      item.iconClip.length >= 3,
      `items.json.${item.id}.iconClip: requires at least three points`
    )

    if (item.scrap) requireCondition(
      item.consumable && (item.maxStack ?? 1) === 1 && !item.recovery && !item.bonus && !item.bonuses && !item.firearm && !item.ammunition && !item.keys,
      `items.json.${item.id}.scrap: must be non-stackable consumable scrap without other effects`
    )

    if (item.ammunition) {
      requireCondition(
        item.consumable && !item.recovery && !item.firearm,
        `items.json.${item.id}.ammunition: ammunition must be consumable without recovery or firearm settings`
      )
    }

    if (item.firearm) {
      const ammunition = items.find(candidate => candidate.id === item.firearm!.ammunitionId)
      requireCondition(
        ammunition?.ammunition && ammunition.id !== item.id,
        `items.json.${item.id}.firearm.ammunitionId: requires an existing ammunition item`
      )
    }

    const stackCap = item.ammunition ? 6 : ['red-cigarettes', 'grey-cigarettes'].includes(item.id) ? 10 : 5
    requireCondition(
      item.id === 'money' ? item.maxStack === 100 : (item.maxStack ?? 1) <= stackCap,
      `items.json.${item.id}.maxStack: invalid stack limit`
    )
    requireCondition(
      item.id === 'money' || item.consumable || (item.maxStack ?? 1) === 1,
      `items.json.${item.id}.maxStack: only consumables may stack`
    )
    if (item.recovery) {
      requireCondition(item.consumable, `items.json.${item.id}.recovery: requires consumable`)
      requireCondition(
        Object.keys(item.recovery).length > 0 || buffs.some(buff => buff.itemIds.includes(item.id)),
        `items.json.${item.id}.recovery: requires a recovery amount`
      )
    }

    const stealthBonus = itemBonuses(item).find(bonus => 'skill' in bonus && bonus.skill === 'stealth')?.amount ?? 0
    requireCondition(stealthBonus + Math.max(0, item.stealthModifier ?? 0) <= 3,
      `items.json.${item.id}.stealthModifier: combined skill bonus cannot exceed 3`)
    const skillBonuses = itemBonuses(item).filter(bonus => 'skill' in bonus)
    const skillTargets = new Set(skillBonuses.map(bonus => bonus.skill))
    if ((item.stealthModifier ?? 0) > 0) skillTargets.add('stealth')

    const skillTotal = skillBonuses.reduce((sum, bonus) => sum + bonus.amount, 0) + Math.max(0, item.stealthModifier ?? 0)
    requireCondition(skillTargets.size < 2 || skillTotal === 4,
      `items.json.${item.id}.bonuses: multiple skill bonuses must total 4`)
  }

  unique(ui.stats.map(stat => stat.id), 'ui.json.stats')
  requireCondition(
    ui.stats.length === 3,
    'ui.json.stats: requires health, energy and sanity'
  )

  for (const item of items) requireCondition(
    item.icon.x >= 0 && item.icon.y >= 0 && item.icon.x + item.icon.width <= (item.iconSheet ?? ui.itemSheet).width
    && item.icon.y + item.icon.height <= (item.iconSheet ?? ui.itemSheet).height,
    `items.json.${item.id}.icon: crop exceeds the item sheet`
  )

  for (const stat of ui.stats) requireCondition(stat.value <= stat.max, `ui.json.stats.${stat.id}: value exceeds max`)
}
