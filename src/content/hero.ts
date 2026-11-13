import type base from './hero/index.json'
import { CONTENT } from './catalogue'

const config = CONTENT.data.hero as typeof base & {
  steps: Record<string, readonly SpriteStep[]>
  animations: Record<string, AnimationConfig>
}

export const HERO_ASSET = config.asset
export const HERO_ACTION = config.actions
export type HeroAction = string
export interface SpriteStep {
  x: number; y: number; width: number; height: number; anchorX?: number; anchorY?: number; scale?: number; keepLargestComponent?: boolean
  excludeRegions?: readonly { x: number; y: number; width: number; height: number }[]
}
export const HERO_ANIMATION_STEPS: Readonly<Record<string, readonly SpriteStep[]>> = config.steps
export const HERO_MATTE = config.matte
interface AnimationConfig { frameRate?: number; durationMs?: number; repeat: number }
const animations: Record<string, AnimationConfig> = config.animations
export const HERO_SETTINGS = {
  ...config.settings,
  jumpDurationMs: animations[HERO_ACTION.jump].durationMs!,
}
// Duration-based animations stay synchronized when authors change the jump length.
export const HERO_ANIMATIONS = Object.fromEntries(Object.entries(animations).map(([key, animation]) => [key, {
  frameRate: animation.durationMs ? HERO_ANIMATION_STEPS[key].length * 1000 / animation.durationMs : animation.frameRate!,
  repeat: animation.repeat,
}]))
export function heroFrameKey(action: HeroAction, step: number): string { return `${action}-${step}` }
