import { array, boolean, number, object, optional, record, text } from '../schema.ts'
import { asset, positive, rect } from './common.ts'
const steps = record(array(
  object({
    x: number(),
    y: number(),
    width: positive,
    height: positive,
    anchorX: optional(number()),
    anchorY: optional(number()),
    scale: optional(positive),
    keepLargestComponent: optional(boolean),
    excludeRegions: optional(array(rect))
  }),
  true
))
export const heroSchema = object({
  asset,
  actions: object({
    idle: text,
    run: text,
    jump: text,
    fight: text,
    shoot: text,
    fightPrepare: text,
    shootPrepare: text,
    hurt: text,
    death: text
  }),
  steps,
  outfits: record(object({ asset, steps })),
  settings: object({
    speed: positive,
    scale: positive,
    roomScale: positive,
    edgeMargin: number(),
    maxDeltaMs: positive,
    jumpHeight: positive,
    frameWidth: positive,
    frameHeight: positive,
    footWidth: positive,
    energyCosts: object({ jump: number(0), perPixel: number(0) }),
    attackTiming: object({
      halfCycleMs: positive,
      minDamageMultiplier: positive,
      maxDamageMultiplier: positive,
      radius: positive,
      dotRadius: positive,
      lineWidth: positive,
      feedbackDurationMs: positive,
      feedbackOffset: number(0),
      ringColor: number(0, true, 16777215),
      dotColor: number(0, true, 16777215),
      perfectColor: number(0, true, 16777215)
    }),
    fallDamage: object({ safeHeight: number(0), damagePerPixel: number(0) }),
    hitFlashMs: number(0),
    meleeDamage: number(1, true),
    shotDamage: number(1, true),
    meleeRange: positive,
    combatLevelTolerance: number(0)
  }),
  animations: record(object({
    frameRate: optional(positive),
    durationMs: optional(positive),
    repeat: number(-1, true)
  })),
  // Channel differences are signed so neutral black sheets can remove warm edge pixels too.

  matte: object({
    redMax: number(0, false, 255),
    greenMax: number(0, false, 255),
    blueMax: number(0, false, 255),
    minGreenRed: number(-255, false, 255),
    minBlueRed: number(-255, false, 255)
  }),
})
