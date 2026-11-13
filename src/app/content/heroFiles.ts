/** Assemble per-action hero animation files without changing the runtime shape. */
export function heroFiles(files: Record<string, unknown>, sources: Record<string, string>): Record<string, unknown> {
  const indexPath = './hero/index.json'
  const consumed = new Set<string>()
  const expanded = { ...files }
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
    for (const [action, key] of Object.entries(actions)) {
      if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(action) || typeof key !== 'string' || !key) throw new Error(`${indexPath}.actions.${action}: invalid action`)
      if (Object.hasOwn(animations, key)) throw new Error(`${indexPath}.actions.${action}: duplicate animation key ${key}`)
      const path = `./hero/animations/${action}.json`
      const animation = read(path)
      if (!Array.isArray(animation.steps)) throw new Error(`${path}.steps: expected an array`)
      steps[key] = animation.steps
      delete animation.steps
      animations[key] = animation
      sources[`hero.json.steps.${key}`] = `src/content/${path.slice(2)}.steps`
      sources[`hero.json.animations.${key}`] = `src/content/${path.slice(2)}`
    }
    expanded['./hero.json'] = { ...hero, steps, animations }
  }
  for (const path of Object.keys(files)) {
    if (path.startsWith('./hero/') && !consumed.has(path)) throw new Error(`${path}: unrecognized hero content file`)
    if (consumed.has(path)) delete expanded[path]
  }
  return expanded
}
