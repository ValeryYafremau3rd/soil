import { DAY_PHASES } from '../../contracts/daytime.ts'
import { array, boolean, choice, number, object, optional, text } from '../schema.ts'
export const positive = number(Number.MIN_VALUE)
export const integer = number(0, true)
export const quality = number(1, true, 5)
export const rect = object({ x: number(), y: number(), width: positive, height: positive })
export const stack = object({ itemId: text, quantity: number(1, true) })
export const floor = object({ y: number(), left: number(), right: positive, ceiling: number() })
export const surface = object({
  left: number(0, false, 1),
  right: number(0, false, 1),
  top: number(0, false, 1),
  rightTop: optional(number(0, false, 1)),
  bottom: optional(number(0, false, 1))
})
export const view = object({
  key: text,
  groundY: number(),
  crop: rect,
  floors: array(floor, true),
  platforms: optional(array(surface))
})
export const spriteFields = {
  key: text,
  path: text,
  background: choice('none', 'light', 'dark'),
  referenceWidth: optional(positive),
  crop: optional(rect),
  outline: optional(array(object({ x: number(0), y: number(0) }), true))
}
export const sprite = object(spriteFields)
export const placementFields = {
  id: text,
  locationId: text,
  type: text,
  x: number(),
  space: choice('inside', 'outside'),
  buildingId: optional(text),
  floor: optional(integer),
  enabled: optional(boolean),
  scale: optional(positive)
}
export const asset = object({ key: text, path: text, referenceWidth: positive })
export const barter = object({
  id: text,
  name: text,
  locationId: text,
  requiresQuest: optional(text),
  items: optional(array(stack, true)),
  stock: optional(object({
    offers: optional(array(object({ itemId: text, chance: number(0, false, 1) }), true)),
    categories: array(text, true),
    minItems: number(1, true),
    maxItems: number(1, true),
    minQuantity: number(1, true),
    maxQuantity: number(1, true)
  }))
})
export const npcFrame = object({
  x: number(),
  y: number(),
  width: positive,
  height: positive,
  anchorX: optional(number()),
  anchorY: optional(number()),
  scale: optional(positive),
  excludeRegions: optional(array(rect))
})
export const walkAnimation = object({ key: text, frameRate: positive, steps: array(npcFrame, true) })
export const npcFields = {
  portraitIndex: optional(number(0, true, 7)),
  portraitBackgroundThreshold: optional(number(0, true, 255)),
  name: text,
  sourceKey: text,
  textureKey: text,
  path: text,
  idleAnimation: text,
  flipX: optional(boolean),
  referenceWidth: positive,
  frameRate: positive,
  displayHeight: positive,
  scale: optional(positive),
  depth: number(),
  interactionRadius: positive,
  idleSteps: array(npcFrame, true),
  frameSize: optional(object({
    width: number(1, true),
    height: number(1, true),
    referenceHeight: optional(number(1, true))
  })),
  dialogueId: optional(text),
  background: optional(choice('none', 'light', 'dark')),
  repeat: optional(number(-1, true)),
  backgroundThreshold: optional(number(0, true, 255)),
  backgroundMinGreenRed: optional(number(-255, true, 255)),
  keepLargestComponent: optional(boolean),
  walk: optional(walkAnimation),
  run: optional(walkAnimation),
  attack: optional(walkAnimation),
  shoot: optional(walkAnimation),
  death: optional(walkAnimation),
  schedule: optional(object(Object.fromEntries(DAY_PHASES.map(phase => [phase, optional(object({
    locationId: text, x: number(0), scale: optional(positive), enabled: optional(boolean),
    buildingId: optional(text), roomId: optional(text), floor: optional(integer),
  }))])))),
}
