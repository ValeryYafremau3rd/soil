/** Flatten patrol animation files into the existing runtime definition. */
export function patrolFiles(files: Record<string, unknown>, sources: Record<string, string>): Record<string, unknown> {
  const expanded = { ...files }
  const consumed = new Set<string>()
  function read(path: string): Record<string, unknown> {
    const value = files[path]
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`src/content/${path.slice(2)}: expected an object`)
    consumed.add(path)
    return { ...value as Record<string, unknown> }
  }
  for (const path of Object.keys(files).sort()) {
    const match = /^\.\/patrols\/types\/([^/]+)\/index\.json$/.exec(path)
    if (!match) continue
    const target = `./patrols/types/${match[1]}.json`
    if (target in files) throw new Error(`${path}: duplicate patrol file ${target}`)
    const patrol = read(path)
    const prefix = `patrols.json.types.${match[1]}`
    sources[prefix] = `src/content/${path.slice(2)}`
    const folder = path.slice(0, -10)
    const idlePath = `${folder}animations/idle.json`
    const idle = read(idlePath)
    for (const field of Object.keys(idle)) {
      if (!['idleAnimation', 'frameRate', 'repeat', 'idleSteps'].includes(field)) throw new Error(`${idlePath}: unknown idle field ${field}`)
      if (field in patrol) throw new Error(`${path}: ${field} belongs in ${idlePath}`)
      patrol[field] = idle[field]
      sources[`${prefix}.${field}`] = `src/content/${idlePath.slice(2)}.${field}`
    }
    for (const animation of ['walk', 'run', 'attack', 'death', 'shoot']) {
      const animationPath = `${folder}animations/${animation}.json`
      if (animation === 'shoot' && !(animationPath in files)) continue
      if (animation in patrol) throw new Error(`${path}: ${animation} belongs in ${animationPath}`)
      patrol[animation] = read(animationPath)
      sources[`${prefix}.${animation}`] = `src/content/${animationPath.slice(2)}`
    }
    expanded[target] = patrol
  }
  for (const path of Object.keys(files)) {
    if (/^\.\/patrols\/types\/[^/]+\//.test(path) && !consumed.has(path)) throw new Error(`${path}: unrecognized patrol content file`)
    if (consumed.has(path)) delete expanded[path]
  }
  return expanded
}
