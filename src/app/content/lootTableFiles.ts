type Files = Record<string, unknown>

/**
 * Resolve authored vendor and corpse table references before runtime validation.
 * Inline definitions remain supported for fixtures and older content tooling.
 * @param {Files} files - Discovered JSON files, keyed by relative content path.
 * @returns {Files} Copies with references expanded into existing runtime shapes.
 * @throws {Error} A reference is missing, invalid, or conflicts with inline data.
 */
export function lootTableFiles(files: Files): Files {
  return Object.fromEntries(Object.entries(files).map(([path, value]) => [
    path,
    expandLootReferences(value, files, path),
  ]))
}

/**
 * Expand references recursively without mutating discovered JSON objects.
 * @param {unknown} value - Authored value to inspect.
 * @param {Files} files - Available table files.
 * @param {string} path - Source path for actionable validation errors.
 * @returns {unknown} Value with validated references expanded.
 */
function expandLootReferences(value: unknown, files: Files, path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      expandLootReferences(entry, files, `${path}[${index}]`),
    )
  }

  if (!value || typeof value !== 'object') return value

  const result: Files = {}

  for (const [key, entry] of Object.entries(value)) {
    const reference = key === 'stockTable' || key === 'corpseLootTable'
    if (!reference) {
      result[key] = expandLootReferences(entry, files, `${path}.${key}`)
      continue
    }

    const target = key === 'stockTable' ? 'stock' : 'corpseLoot'
    const folder = key === 'stockTable' ? 'vendors' : 'corpses'
    result[target] = readLootTable(files, entry, folder, path, target, value)
  }

  return result
}

/**
 * Read a local table using a filename identifier, rejecting ambiguous overrides.
 * @param {Files} files - Available authored JSON files.
 * @param {unknown} id - Referenced filename without its extension.
 * @param {string} folder - Table category under loot-tables.
 * @param {string} path - Referencing source path.
 * @param {string} target - Runtime field populated by the table.
 * @param {object} owner - Object containing the reference.
 * @returns {unknown} Authored table, checked later by existing runtime schemas.
 */
function readLootTable(
  files: Files,
  id: unknown,
  folder: string,
  path: string,
  target: string,
  owner: object,
): unknown {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`${path}: invalid ${target} table identifier`)
  }

  const tablePath = `./loot-tables/${folder}/${id}.json`
  if (!(tablePath in files)) throw new Error(`${path}: unknown loot table ${tablePath}`)
  if (target in owner) throw new Error(`${path}: specify a table or inline ${target}, not both`)

  return structuredClone(files[tablePath])
}
