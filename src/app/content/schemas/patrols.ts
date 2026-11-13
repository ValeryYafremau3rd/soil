import { DAY_PHASES } from '../../contracts/daytime.ts'
import { array,boolean,choice,number,object,optional,record,text } from '../schema.ts'
import { integer,npcFields,positive,walkAnimation } from './common.ts'
export const patrolsSchema = object({
    types: record(object({ ...npcFields, walk: walkAnimation, run: walkAnimation, attack: walkAnimation, death: walkAnimation,
      kind: optional(choice('human', 'monster')),
      corpseLoot: optional(array(object({ itemId: text, min: integer, max: integer }), true)),
      combat: object({ detectionRadius: positive, health: number(1, true), meleeDamage: number(1, true), meleeRange: positive,
        ranged: optional(object({ damage: number(1, true), range: positive, heightTolerance: number(0) })),
        fear: optional(object({ radius: positive, sanityPerSecond: number(0), noticeSanityDamage: number(0, true) })),
        hitFlashMs: number(0), chaseStopRatio: number(0, false, 1),
        attackCooldownMs: positive, reactionDelayMs: number(0), deathHoldMs: number(0), chaseSpeed: positive, levelTolerance: number(0) }),
      movement: object({ speed: positive,
      minWalkMs: positive, maxWalkMs: positive, minPauseMs: positive, maxPauseMs: positive }) })),
    locations: record(object({ type: text, counts: object(Object.fromEntries(DAY_PHASES.map(phase => [phase, integer]))),
      bounds: object({ left: number(0, false, 1), right: number(0, false, 1) }), scale: optional(positive), enabled: optional(boolean),
      nightEncounters: optional(array(object({ type: text, weight: positive, count: integer }))),
      emptyInteriorSpawn: optional(object({ type: text, chance: number(0, false, 1) })),
      interiors: optional(array(object({ id: text, buildingId: text, floor: integer, type: text,
        counts: object(Object.fromEntries(DAY_PHASES.map(phase => [phase, integer]))),
        bounds: object({ left: number(0, false, 1), right: number(0, false, 1) }), scale: optional(positive), enabled: optional(boolean) }))) })),
  })
