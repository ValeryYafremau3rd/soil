type Files = Record<string, unknown>

/**
 * Expand per-outfit folders into the established hero authoring format.
 * @param {Files} files - Discovered JSON files; inputs are never mutated.
 * @param {Record<string, string>} sources - Runtime-to-authored diagnostic paths.
 * @returns {Files} Outfit definitions and basic animations ready for hero assembly.
 */
export function expandHeroOutfitFiles(files: Files, sources: Record<string, string>): Files {
  const expanded = { ...files }
  const heroPath = './hero/index.json'
  if (!(heroPath in files)) return expanded

  const hero = readObject(files, heroPath)
  const basic = hero.basicOutfit
  if (basic !== undefined && (typeof basic !== 'string' || !/^[a-zA-Z0-9-]+$/.test(basic))) {
    throw new Error(`${heroPath}.basicOutfit: invalid outfit identifier`)
  }
  if (basic !== undefined && !(`./hero/outfits/${basic}/index.json` in files)) {
    throw new Error(`${heroPath}.basicOutfit: unknown outfit ${basic}`)
  }

  const actions = readActions(hero.actions, heroPath)
  for (const path of Object.keys(files).sort()) {
    const match = /^\.\/hero\/outfits\/([^/]+)\/index\.json$/.exec(path)
    if (!match) continue

    const id = match[1]
    const outfit = readObject(files, path)
    if ('steps' in outfit) throw new Error(`${path}: steps belong in animation files`)
    const steps: Files = {}
    const target = `./hero/outfits/${id}.json`
    if (target in files) throw new Error(`${path}: duplicate outfit ${target}`)

    for (const [action, key] of Object.entries(actions)) {
      const animationPath = `./hero/outfits/${id}/animations/${action}.json`
      const animation = readObject(files, animationPath)
      if (!Array.isArray(animation.steps)) throw new Error(`${animationPath}.steps: expected an array`)
      if (id === basic) {
        const legacyPath = `./hero/animations/${action}.json`
        if (legacyPath in files) throw new Error(`${animationPath}: duplicate animation ${legacyPath}`)
        expanded[legacyPath] = animation
        sources[`hero.json.steps.${key}`] = `src/content/${animationPath.slice(2)}.steps`
        sources[`hero.json.animations.${key}`] = `src/content/${animationPath.slice(2)}`
      } else {
        for (const field of Object.keys(animation)) {
          if (field !== 'steps' && field !== '$comment') {
            throw new Error(`${animationPath}.${field}: outfit timing is shared with the basic outfit`)
          }
        }
        steps[key] = animation.steps
        sources[`hero.json.outfits.${id}.steps.${key}`] = `src/content/${animationPath.slice(2)}.steps`
      }
      delete expanded[animationPath]
    }

    if (id === basic) {
      if ('asset' in hero) throw new Error(`${heroPath}: asset belongs to the basic outfit`)
      for (const field of Object.keys(outfit)) {
        if (field !== 'asset' && field !== '$comment') throw new Error(`${path}.${field}: unknown basic outfit field`)
      }
      hero.asset = outfit.asset
      sources['hero.json.asset'] = `src/content/${path.slice(2)}.asset`
    } else {
      expanded[target] = { ...outfit, steps }
      sources[`hero.json.outfits.${id}`] = `src/content/${path.slice(2)}`
    }
    delete expanded[path]
  }

  delete hero.basicOutfit
  expanded[heroPath] = hero
  return expanded
}

/**
 * Read a JSON object with its owning filename in the error.
 * @param {Files} files - Discovered JSON definitions.
 * @param {string} path - Required object path.
 * @returns {Files} A shallow copy so assembly cannot mutate authored input.
 */
function readObject(files: Files, path: string): Files {
  const value = files[path]
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`src/content/${path.slice(2)}: expected an object`)
  }
  return { ...value as Files }
}

/**
 * Check action identifiers before using them as filenames or runtime keys.
 * @param {unknown} value - Authored action-to-animation-key map.
 * @param {string} path - Hero index path for diagnostics.
 * @returns {Record<string, string>} Validated action identifiers and keys.
 */
function readActions(value: unknown, path: string): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path}.actions: expected an object`)
  }
  for (const [action, key] of Object.entries(value)) {
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(action) || typeof key !== 'string' || !key) {
      throw new Error(`${path}.actions.${action}: invalid action`)
    }
  }
  return value as Record<string, string>
}
