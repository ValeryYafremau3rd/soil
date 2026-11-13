import { array,boolean,number,object,optional,text } from '../schema.ts'
import { integer,positive } from './common.ts'
export const locationsSchema = array(object({ id: text, name: text, description: text, order: optional(integer),
    connections: optional(object({ left: optional(text), right: optional(text) })),
    initialSpawn: optional(object({ buildingId: text, roomId: text, x: number() })),
    background: object({ key: text, path: text, height: positive, groundRatio: number(0, false, 1), scale: optional(positive), scrollFactor: optional(number(0, false, 1)) }),
    busStop: object({ x: number(), scale: positive, interactionRadius: positive, spawnOffset: number() }),
    buildings: array(object({ id: text, type: text, entranceX: number(), enabled: optional(boolean), scale: optional(positive) })),
    npc: optional(object({ type: text, x: number(), enabled: optional(boolean), scale: optional(positive) })),
  }), true)
