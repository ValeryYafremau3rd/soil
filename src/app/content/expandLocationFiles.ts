import type { BuildingDefinition } from '../../content/types'

type ObjectData = Record<string, unknown>

/**
 * Expand location folders into the existing validated runtime format.
 * @param {Record<string, unknown>} files - The files supplied to this operation.
 * @param {Map<object, string>} origins - The origins supplied to this operation.
 * @returns {Record<string, unknown>} The result described by the TypeScript return signature.
 */
export function expandLocationFiles(
  files: Record<string, unknown>,
  origins: Map<object, string>
): Record<string, unknown> {
  const expanded = { ...files }
  const consumed = new Set<string>()

  /**
   * Perform read.
   * @param {string} path - The path supplied to this operation.
   * @returns {ObjectData} The result described by the TypeScript return signature.
   */
  function read(path: string): ObjectData {
    const value = files[path]
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected an object`)

    consumed.add(path)

    return { ...value as ObjectData }
  }

  for (const path of Object.keys(files).sort()) {
    const match = /^\.\/locations\/([^/]+)\/index\.json$/.exec(path)
    if (!match) continue

    const prefix = path.slice(0, -10)
    const location = read(path)
    const target = `./locations/${match[1]}.json`
    if (target in files) throw new Error(`${path}: duplicate location file ${target}`)

    if (location.id !== match[1]) throw new Error(`${path}: id must match the folder`)

    if ('buildings' in location) throw new Error(`${path}: buildings belong in building folders`)

    origins.set(location, `src/content/${path.slice(2)}`)
    const buildings: ObjectData[] = []
    location.buildings = buildings

    /**
     * Perform placements.
     * @param {string} folder - The folder supplied to this operation.
     * @param {ObjectData | undefined} building - The building supplied to this operation.
     * @param {string | undefined} roomId - The room id supplied to this operation.
     * @returns {void} Completes the operation without returning a value.
     */
    function placements(
      folder: string,
      building?: ObjectData,
      roomId?: string
    ): void {
      const definition = building && files[`./buildings/${building.type}.json`] as BuildingDefinition | undefined
      const room = roomId && definition?.rooms?.find(room => room.id === roomId)
      if (building && !definition) throw new Error(`${folder}: unknown building type ${building.type}`)

      if (roomId && !room) throw new Error(`${folder}: unknown room ${roomId}`)

      const scale = definition ? definition.scale * Number(building?.scale ?? 1) : 1
      const left = definition ? Number(building?.entranceX) - definition.entranceX * scale : 0

      for (const field of ['containers', 'furniture', 'taskboards']) {
        const file = `${folder}${field}.json`
        if (!(file in files)) continue

        consumed.add(file)
        const values = files[file]
        if (!Array.isArray(values)) throw new Error(`${file}: expected an array`)

        if (roomId && field !== 'containers') throw new Error(`${file}: room placements currently support containers only; use room template furniture`)

        const result = (location[field] ??= []) as ObjectData[]

        for (const [index, value] of values.entries()) {
          const source = `src/content/${file.slice(2)}[${index}]`
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${source}: expected an object`)

          const piece = { ...value } as ObjectData

          for (const key of ['locationId', ...(building ? ['buildingId', 'roomId', 'space'] : [])]) {
            if (key in piece) throw new Error(`${source}: ${key} is inherited from the folder`)
          }

          if (building) {
            if (typeof piece.x !== 'number' || !Number.isFinite(piece.x)) throw new Error(`${source}.x: expected a finite number`)

            if (piece.scale !== undefined && (typeof piece.scale !== 'number' || piece.scale <= 0)) throw new Error(`${source}.scale: expected a positive number`)

            piece.x = left + ((room ? room.x : 0) + piece.x) * scale
            piece.scale = Number(piece.scale ?? 1) * scale
            if (piece.heightOffset !== undefined) {
              if (typeof piece.heightOffset !== 'number') throw new Error(`${source}.heightOffset: expected a number`)

              piece.heightOffset *= scale
            }

            Object.assign(piece, { buildingId: building.id, space: 'inside' })
            if (room) {
              if ('floor' in piece) throw new Error(`${source}: floor is inherited from the room`)

              Object.assign(piece, { roomId, floor: room.floor })
            }
          }

          origins.set(piece, source)
          result.push(piece)
        }
      }
    }
    placements(prefix)

    for (const buildingPath of Object.keys(files).sort()) {
      if (!buildingPath.startsWith(`${prefix}buildings/`) || !/^buildings\/[^/]+\/index\.json$/.test(buildingPath.slice(prefix.length))) continue

      const building = read(buildingPath)
      const buildingFolder = buildingPath.slice(0, -10)
      if (building.id !== buildingFolder.split('/').at(-2)) throw new Error(`${buildingPath}: id must match the folder`)

      buildings.push(building)
      origins.set(building, `src/content/${buildingPath.slice(2)}`)
      placements(buildingFolder, building)
      const roomIds = new Set(Object.keys(files).filter(file => file.startsWith(`${buildingFolder}rooms/`)).map(file => file.slice(`${buildingFolder}rooms/`.length).split('/')[0]))

      for (const roomId of roomIds) placements(`${buildingFolder}rooms/${roomId}/`, building, roomId)
    }

    expanded[target] = location
  }

  for (const path of Object.keys(files)) {
    if (/^\.\/locations\/[^/]+\//.test(path) && !consumed.has(path)) throw new Error(`${path}: unrecognized location content file`)

    if (consumed.has(path)) delete expanded[path]
  }

  return expanded
}
