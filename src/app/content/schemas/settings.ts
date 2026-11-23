import { array, number, object, optional, text } from '../schema.ts'
import { positive, surface } from './common.ts'
import { DAY_PHASES } from '../../contracts/daytime.ts'
export const settingsSchema = object({
  layers: object({
    background: number(),
    outdoors: number(),
    interiorShade: number(),
    building: number(),
    roomShade: number(),
    room: number(),
    actors: number(),
    hero: number(),
    hints: number(),
    daytimeTint: number()
  }),
  lighting: object({
    depth: number(),
    phaseIntensity: object(Object.fromEntries(DAY_PHASES.map(phase => [phase, number(0, false, 1)]))),
    sources: object(Object.fromEntries(
      ['entrance', 'corridor', 'room', 'busStop', 'taskboard'].map(kind => [
        kind,
        object({
          color: number(0, true, 0xffffff),
          radius: positive,
          intensity: number(0),
          attenuation: positive,
          offsetY: number(-Infinity),
        })
      ]),
    ))
  }),
  combatFeedback: object({
    hitTint: number(0, true, 0xffffff),
    healthBar: object({
      width: positive,
      height: positive,
      offsetY: number(),
      backgroundColor: number(0, true, 0xffffff),
      fillColor: number(0, true, 0xffffff)
    })
  }),
  exitMarker: object({ label: text, offsetY: number(0), color: text, backgroundColor: text, fontSize: text }),
  interiorShade: object({ color: number(), alpha: number(0, false, 1) }),
  roomShade: object({ color: number(), alpha: number(0, false, 1) }),
  roomExitRadius: positive,
  scene: object({
    width: positive,
    height: positive,
    backgroundColor: text,
    cameraFollowX: number(0, false, 1),
    cameraFollowY: number(0, false, 1),
    groundScreenRatio: number(0, false, 1)
  }),
  interaction: object({
    storyGlow: object({
      label: text, offsetY: number(), periodMs: positive,
      minAlpha: number(0, false, 1), maxAlpha: number(0, false, 1),
      selectedScale: positive, shadowColor: text, shadowBlur: number(0),
      style: object({
        fontFamily: text, fontSize: text, color: text,
        stroke: text, strokeThickness: number(0)
      })
    }),
    verticalTolerance: positive,
    hintWidth: positive,
    hintGap: number(),
    hintOffset: number(),
    interiorHeadroom: number(),
    minimumInteriorHeight: positive,
    style: object({
      fontFamily: text,
      fontSize: text,
      color: text,
      backgroundColor: text,
      padding: object({ x: number(), y: number() })
    })
  }),
  input: object({
    left: text,
    right: text,
    jump: text,
    fight: text,
    shoot: text,
    interact: text,
    up: text,
    down: text
  }),
  busStop: object({
    sourceKey: text,
    textureKey: text,
    path: text,
    groundOrigin: number(0, false, 1),
    prompt: text,
    platforms: optional(array(surface))
  }),
})
