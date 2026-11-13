import { ITEM_RARITIES } from '../../../domain/inventory/items.ts'
import { ATTRIBUTE_LABELS,SKILL_LABELS } from '../../../domain/skills/character.ts'
import { array,boolean,choice,number,object,optional,text } from '../schema.ts'
import { positive,quality,rect } from './common.ts'
export const itemsSchema = array(object({ id: text, name: text, price: number(1, true), rarity: choice(...ITEM_RARITIES), quality, randomLoot: optional(boolean), category: text, description: optional(text), icon: rect, scale: optional(positive),
    keys: optional(array(object({ id: text, name: text, doorId: text }), true)),
    attachToKeyRing: optional(boolean),
    iconSheet: optional(object({ path: text, width: positive, height: positive })),
    equipmentSlot: optional(choice('ranged', 'melee', 'tool', 'armor', 'shoes', 'accessory', 'amulet', 'bag')),
    inventorySlots: optional(number(1, true, 30)),
    patrolPass: optional(boolean), saleable: optional(boolean),
    iconClip: optional(array(object({ x: number(0, false, 1), y: number(0, false, 1) }), true)),
    consumable: optional(boolean), scrap: optional(boolean), maxStack: optional(number(1, true, 100)), eruditionRequired: number(1, true, 20),
    skillRequirements: optional(object(Object.fromEntries(Object.keys(SKILL_LABELS).filter(skill => skill !== 'erudition')
      .map(skill => [skill, optional(number(1, true, 10))])))),
    ammunition: optional(boolean), firearm: optional(object({ ammunitionId: text })),
    damageMultiplier: optional(number(1, false, 1.5)),
    stealthModifier: optional(number(-10, true, 10)),
    damageResistance: optional(number(1, true, 20)),
    fearResistance: optional(number(5, true, 20)),
    requirementMode: optional(choice('any')),
    bonus: optional({ kind: 'union', items: [
      object({ attribute: choice(...Object.keys(ATTRIBUTE_LABELS)), amount: number(1, true, 3) }),
      object({ skill: choice(...Object.keys(SKILL_LABELS)), amount: number(1, true, 10) }),
    ] }),
    bonuses: optional(array({ kind: 'union', items: [
      object({ attribute: choice(...Object.keys(ATTRIBUTE_LABELS)), amount: number(1, true, 3) }),
      object({ skill: choice(...Object.keys(SKILL_LABELS)), amount: number(1, true, 10) }),
    ] }, true)),
    recovery: optional(object({ health: optional(number(1, true)), energy: optional(number(1, true)), sanity: optional(number(1, true)) })),
  }), true)
