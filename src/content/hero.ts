import type base from './hero/index.json'
import type basic from './hero/outfits/basic/index.json'
import { CONTENT } from './catalogue'

const config = CONTENT.data.hero as Omit<typeof base, 'basicOutfit'> & {
  asset: typeof basic.asset
  steps: Record<string, readonly SpriteStep[]>
  animations: Record<string, AnimationConfig>
  outfits: Readonly<Record<string, {
    asset: typeof basic.asset
    steps: Readonly<Record<string, readonly SpriteStep[]>>
  }>>
}

export const HERO_ASSET = config.asset
export const HERO_OUTFITS = config.outfits
export const HERO_ACTION = config.actions
export type HeroAction = string
/**
 * One prepared sprite animation frame with crop and alignment information.
 */
export interface SpriteStep {
  x: number
  y: number
  width: number
  height: number
  anchorX?: number
  anchorY?: number
  scale?: number
  keepLargestComponent?: boolean
  excludeRegions?: readonly {
    x: number
    y: number
    width: number
    height: number
  }[]
}
export const HERO_ANIMATION_STEPS: Readonly<Record<string, readonly SpriteStep[]>> = config.steps
export const HERO_MATTE = config.matte
/**
 * Animation identity, frame timing and frame sequence for sprite preparation.
 */
interface AnimationConfig {
  frameRate?: number
  durationMs?: number
  repeat: number
}
const animations: Record<string, AnimationConfig> = config.animations
export const HERO_SETTINGS = {
  ...config.settings,
  jumpDurationMs: animations[HERO_ACTION.jump].durationMs!,
}
// Duration-based animations stay synchronized when authors change the jump length.
export const HERO_ANIMATIONS = Object.fromEntries(Object.entries(animations).map(([key, animation]) => [
  key,
  {
    frameRate: animation.durationMs ? HERO_ANIMATION_STEPS[key].length * 1000 / animation.durationMs : animation.frameRate!,
    repeat: animation.repeat,
  }
]))

/**
 * Perform hero frame key.
 * @param {string} action - The action supplied to this operation.
 * @param {number} step - The step supplied to this operation.
 * @returns {string} The resolved text value.
 */
export function heroFrameKey(
  action: HeroAction,
  step: number
): string {
  return `${action}-${step}`
}
