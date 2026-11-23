import { expandHeroOutfitFiles } from './expandHeroOutfitFiles.ts'

/**
 * Assemble hero animation and outfit files without changing the runtime shape.
 * @param {Record<string, unknown>} files - The files supplied to this operation.
 * @param {Record<string, string>} sources - The sources supplied to this operation.
 * @returns {Record<string, unknown>} The result described by the TypeScript return signature.
 */
export function assembleHeroFiles(
  files: Record<string, unknown>,
  sources: Record<string, string>
): Record<string, unknown> {
  files = expandHeroOutfitFiles(files, sources)
  const indexPath = './hero/index.json'
  const consumed = new Set<string>()
  const expanded = { ...files }

  /**
   * Perform read.
   * @param {string} path - The path supplied to this operation.
   * @returns {Record<string, unknown>} The result described by the TypeScript return signature.
   */
  function read(path: string): Record<string, unknown> {
    const value = files[path]
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`src/content/${path.slice(2)}: expected an object`)

    consumed.add(path)

    return { ...value as Record<string, unknown> }
  }
  if (indexPath in files) {
    if ('./hero.json' in files) throw new Error(`${indexPath}: duplicate hero file ./hero.json`)

    const hero = read(indexPath)
    if ('steps' in hero || 'animations' in hero) throw new Error(`${indexPath}: steps and timing belong in animation files`)

    const actions = hero.actions
    if (!actions || typeof actions !== 'object' || Array.isArray(actions)) throw new Error(`${indexPath}.actions: expected an object`)

    const steps: Record<string, unknown> = {}
    const animations: Record<string, unknown> = {}
    sources['hero.json'] = 'src/content/hero/index.json'
    const outfitPaths = Object.keys(files).filter(path => /^\.\/hero\/outfits\/[^/]+\.json$/.test(path)).sort()
    if (outfitPaths.length) {
      if ('outfits' in hero) throw new Error(`${indexPath}: outfits defined both inline and in outfit files`)

      const outfits: Record<string, unknown> = {}

      for (const path of outfitPaths) {
        const id = path.slice('./hero/outfits/'.length, -'.json'.length)
        outfits[id] = read(path)
        sources[`hero.json.outfits.${id}`] ??= `src/content/${path.slice(2)}`
      }

      hero.outfits = outfits
    }

    for (const [action, key] of Object.entries(actions)) {
      if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(action) || typeof key !== 'string' || !key) throw new Error(`${indexPath}.actions.${action}: invalid action`)

      if (Object.hasOwn(animations, key)) throw new Error(`${indexPath}.actions.${action}: duplicate animation key ${key}`)

      const path = `./hero/animations/${action}.json`
      const animation = read(path)
      if (!Array.isArray(animation.steps)) throw new Error(`${path}.steps: expected an array`)

      steps[key] = animation.steps
      delete animation.steps
      animations[key] = animation
      sources[`hero.json.steps.${key}`] ??= `src/content/${path.slice(2)}.steps`
      sources[`hero.json.animations.${key}`] ??= `src/content/${path.slice(2)}`
    }

    expanded['./hero.json'] = { ...hero, steps, animations }
  }

  for (const path of Object.keys(files)) {
    if (path.startsWith('./hero/') && !consumed.has(path)) throw new Error(`${path}: unrecognized hero content file`)

    if (consumed.has(path)) delete expanded[path]
  }

  return expanded
}
