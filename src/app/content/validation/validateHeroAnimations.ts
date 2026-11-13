import { reference,requireCondition } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validateHeroAnimations(context: ContentContext) {
  const { hero } = context
for (const [action, key] of Object.entries(hero.actions)) {
    reference(hero.steps, key, `hero.json.actions.${action}`)
    reference(hero.animations, key, `hero.json.animations.${key}`)
    const animation = hero.animations[key]
    requireCondition(Boolean(animation.frameRate) !== Boolean(animation.durationMs), `hero.json.animations.${key}: set frameRate OR durationMs`)
    if (action === 'jump') requireCondition(animation.durationMs, 'hero.json: jump needs durationMs to synchronize motion')
    for (const crop of hero.steps[key]) {
      requireCondition(crop.x + crop.width <= hero.asset.referenceWidth
      && (crop.anchorX === undefined || crop.anchorX <= crop.width)
      && (crop.anchorY === undefined || crop.anchorY <= crop.height), `hero.json.steps.${key}: invalid crop or foot anchor`)
      for (const excluded of crop.excludeRegions ?? []) requireCondition(excluded.x >= 0 && excluded.y >= 0
        && excluded.x + excluded.width <= crop.width && excluded.y + excluded.height <= crop.height,
      `hero.json.steps.${key}.excludeRegions: outside crop`)
    }
  }
for (const kind of ['fight', 'shoot']) {
    const preparation = hero.actions[`${kind}Prepare`], attack = hero.actions[kind]
    requireCondition(hero.steps[preparation].length === 2, `hero.json.steps.${preparation}: preparation requires exactly two sprites`)
    requireCondition(hero.animations[preparation].repeat === 0 && hero.animations[attack].repeat === 0, `hero.json.animations.${attack}: preparation and attack must not loop`)
  }
}
