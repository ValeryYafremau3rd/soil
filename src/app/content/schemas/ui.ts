import { PERK_ACTIONS } from '../../../domain/character/perks.ts'
import { ATTRIBUTE_LABELS,SKILL_LABELS } from '../../../domain/skills/character.ts'
import { array,boolean,choice,number,object,optional,text } from '../schema.ts'
import { positive } from './common.ts'
export const uiSchema = object({
    consumableBuffs: array(object({ id: text, group: optional(text), name: text, description: text, itemIds: array(text, true), attribute: optional(choice(...Object.keys(ATTRIBUTE_LABELS))), vital: optional(choice('health', 'energy')), damageResistance: optional(boolean), fearResistance: optional(boolean), amount: number(-100, true, 100), durationDays: number(1, true) })),
    perks: array(object({ chargeDamage: optional(object({ start: number(-0.5, false, 0.5), full: number(-0.5, false, 0.5) })), actionPoints: optional(object(Object.fromEntries(PERK_ACTIONS.map(action => [action, optional(number(1, true))])))), skillModifiers: optional(object(Object.fromEntries(Object.keys(SKILL_LABELS).map(skill => [skill, optional(number(-20, true, 20))])))), id: text, group: text, name: text, description: text, itemIds: array(text), goal: number(1, true), sanityMultiplier: positive, withdrawalFraction: number(0, false, 1), willpowerOnUse: number(0, true), willpowerAfterDay: number(-100, true, 0), consumeAtMaximum: boolean })), 
    locationTransition: object({ fadeMs: positive, label: text }),
    itemSheet: object({ path: text, width: positive, height: positive }),
    itemIconSize: positive,
    detailIconSize: positive, noteIconSize: positive, gridColumns: number(1, true), minimumContainerSlots: number(1, true),
    rest: object({ rest: text, sleep: text, cancel: text, healthRecovery: object({ rest: number(0, true), sleep: number(0, true) }),
      energyRecovery: object({ rest: number(0, true), sleep: number(0, true) }), sanityRecovery: object({ rest: number(0, true), sleep: number(0, true) }) }),
    menus: array(object({ id: text, title: text, key: text, emptyMessage: optional(text) })), stats: array(object({ id: choice('health', 'energy', 'sanity'), label: text, value: number(0, true), max: number(1, true), attributeBonuses: array(object({ attribute: choice(...Object.keys(ATTRIBUTE_LABELS)), pointsPerAttribute: number(0, true) })) })),
    selectionKeys: object({ up: array(text, true), down: array(text, true), choose: array(text, true) }),
    controls: array(object({ key: text, label: text })),
  })
