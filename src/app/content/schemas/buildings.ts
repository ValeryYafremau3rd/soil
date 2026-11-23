import { array, boolean, number, object, optional, record, text } from '../schema.ts'
import { integer, positive, sprite, view } from './common.ts'
export const buildingsSchema = record(object({
  name: text,
  sprites: array(sprite, true),
  outer: view,
  inner: view,
  corridorLights: optional(boolean),
  corridorTint: optional(number(0, true, 0xffffff)),
  entranceX: number(),
  stairX: number(),
  stairLandingX: number(),
  interactionRadius: positive,
  stairDurationMs: positive,
  scale: positive,
  entrances: optional(array(number(0), true)),
  stairs: optional(array(
    object({
      fromFloor: integer,
      toFloor: integer,
      fromX: number(0),
      toX: number(0),
      landingX: number(0)
    }),
    true
  )),
  rooms: optional(array(object({ id: text, type: text, floor: integer, x: number(), doorX: number() })))
}))
