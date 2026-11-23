import { array, boolean, number, object, optional, record, text } from '../schema.ts'
import { positive, quality, sprite, stack, surface } from './common.ts'
export const roomsSchema = record(object({
  name: text,
  sprite,
  widthScale: optional(positive),
  groundY: positive,
  bounds: object({ left: number(), right: positive, ceiling: number() }),
  platforms: optional(array(surface)),
  furniture: optional(array(object({ id: text, type: text, x: number(), scale: optional(positive) }))),
  containers: optional(array(object({
    id: text,
    type: text,
    x: number(),
    scale: optional(positive),
    enabled: optional(boolean),
    heightOffset: optional(number(0)),
    developerStock: optional(boolean),
    items: optional(array(stack)),
    lootTable: optional(text),
    locked: optional(boolean),
    keyOnly: optional(boolean),
    restock: optional(boolean),
    quality: optional(quality)
  })))
}))
