import type { ContentInput } from './validateContent'
import type { ItemDefinition } from '../../content/types'
import type { QuestDefinition } from '../../domain/quests/quests'
import type { DialogueDefinition } from '../../domain/dialogue/dialogue'
import { buildFindItemRequests } from './findItemRequests.ts'
import { expandLocationFiles } from './expandLocationFiles.ts'
import { assemblePatrolFiles } from './assemblePatrolFiles.ts'
import { assembleHeroFiles } from './assembleHeroFiles.ts'
import { assembleUiFiles } from './assembleUiFiles.ts'
import { lootTableFiles } from './lootTableFiles.ts'

/**
 * Assembled runtime content and source paths used for validation diagnostics.
 */
export interface ContentCatalogue {
  data: ContentInput
  sources: Record<string, string>
}

/**
 * Assemble authored files independently of the filesystem and bundler.
 * @param {Record<string, unknown>} files - The files supplied to this operation.
 * @returns {ContentCatalogue} The result described by the TypeScript return signature.
 */
export function assembleContent(files: Record<string, unknown>): ContentCatalogue {
  // Design notes are retained in authored files, never treated as runtime schema fields.
  files = Object.fromEntries(Object.entries(files).map(([path, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [path, value]

    const runtime = { ...value } as Record<string, unknown>
    delete runtime._codex
    return [path, runtime]
  }))
  files = lootTableFiles(files)
  const origins = new Map<object, string>()
  files = expandLocationFiles(files, origins)
  const sources: Record<string, string> = {}
  files = assemblePatrolFiles(files, sources)
  files = assembleHeroFiles(files, sources)
  files = assembleUiFiles(files, sources)

  /**
   * Perform entries.
   * @param {string} folder - The folder supplied to this operation.
   * @returns {[string, unknown][]} The result described by the TypeScript return signature.
   */
  function entries(folder: string): [string, unknown][] {
    const prefix = `./${folder}/`

    return Object.entries(files).filter(([path]) => path.startsWith(prefix)
      && path.endsWith('.json')
      && (folder === 'items' || !path.slice(prefix.length).includes('/')))
      // Keep item order independent of category folders: seeded pools rely on it.
      .sort(([a], [b]) => folder === 'items'
        ? a.split('/').pop()!.localeCompare(b.split('/').pop()!) || a.localeCompare(b)
        : a.localeCompare(b))
  }

  /**
   * Perform registry.
   * @param {string} folder - The folder supplied to this operation.
   * @param {string} target - Target considered by this operation.
   * @returns {Record<string, unknown>} The result described by the TypeScript return signature.
   */
  function registry(
    folder: string,
    target: string
  ): Record<string, unknown> {
    return Object.fromEntries(entries(folder).map(([path, value]) => {
      const id = path.split('/').pop()!.slice(0, -5)
      sources[`${target}.${id}`] ??= `src/content/${path.slice(2)}`
      if (folder === 'dialogues') sources[`dialogues/${id}.json`] = `src/content/${path.slice(2)}`

      return [id, value]
    }))
  }

  /**
   * Perform list.
   * @param {string} folder - The folder supplied to this operation.
   * @param {string} target - Diagnostic namespace; defaults to the authored folder name.
   * @returns {Record<string, unknown>[]} The result described by the TypeScript return signature.
   */
  function list(folder: string, target = folder): Record<string, unknown>[] {
    const values = entries(folder).map(([path, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || (value as {
          id?: unknown
        }).id !== path.split('/').pop()!.slice(0, -5)) {
        throw new Error(`src/content/${path.slice(2)}: id must match the filename`)
      }

      return { path, value: value as Record<string, unknown> }
    })
    if (folder === 'locations') values.sort((a, b) => Number(a.value.order ?? 0) - Number(b.value.order ?? 0))

    return values.map((
      { path, value },
      index
    ) => {
      sources[`${target}.json[${index}]`] = origins.get(value) ?? `src/content/${path.slice(2)}`
      sources[`${target}.json.${value.id}`] = sources[`${target}.json[${index}]`]
      if (folder === 'locations' && Array.isArray(value.buildings)) for (const [i, building] of value.buildings.entries()) {
        if (origins.has(building)) sources[`locations.json[${index}].buildings[${i}]`] = origins.get(building)!
      }

      return value
    })
  }
  const placements: unknown[] = []
  const taskboards: unknown[] = []
  const furniture: unknown[] = []

  /**
   * Perform collect placements.
   * @param {Record<string, unknown>} location - The location supplied to this operation.
   * @param {number} index - The index supplied to this operation.
   * @param {string} field - The field supplied to this operation.
   * @param {unknown[]} target - Target considered by this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  function collectPlacements(
    location: Record<string, unknown>,
    index: number,
    field: string,
    target: unknown[]
  ): void {
    const path = `${sources[`locations.json[${index}]`]}.${field}`
    const entries = location[field] === undefined ? [] : location[field]
    if (!Array.isArray(entries)) throw new Error(`${path}: expected an array`)

    for (const [placementIndex, placement] of entries.entries()) {
      const source = origins.get(placement as object) ?? `${path}[${placementIndex}]`
      if (!placement || typeof placement !== 'object' || Array.isArray(placement)) throw new Error(`${source}: expected an object`)

      if ('locationId' in placement) throw new Error(`${source}: locationId is inherited from the location`)

      const object = { ...placement, locationId: location.id } as Record<string, unknown>
      sources[`${field}.json.placements[${target.length}]`] = source
      sources[`${field}.json.placements.${object.id}`] = source
      target.push(object)
    }
  }
  // Location ownership is authored once; flatten only at the runtime boundary.
  const locations = list('locations').map((location, index) => {
    collectPlacements(location, index, 'containers', placements)
    collectPlacements(location, index, 'taskboards', taskboards)
    collectPlacements(location, index, 'furniture', furniture)
    const definition = { ...location }
    delete definition.containers
    delete definition.taskboards
    delete definition.furniture

    return definition
  })
  sources['containers.json'] = 'src/content/containers/settings.json'
  sources['difficulty.json'] = 'src/content/difficulty.json'
  sources['skills.json'] = 'src/content/skills.json'
  sources['advice.json'] = 'src/content/advice.json'
  const items = list('items')
  const requests = buildFindItemRequests(
    items as unknown as ItemDefinition[],
    list('uests', 'quests') as unknown as QuestDefinition[],
    registry('dialogues', 'dialogues.json') as unknown as Record<string, DialogueDefinition>
  )

  for (const quest of requests.quests) {
    if (!sources[`quests.json.${quest.id}`] && quest.findItem) {
      sources[`quests.json.${quest.id}`] = sources[`items.json.${quest.findItem}`]
    }
  }

  return {
    sources,
    data: {
      buildings: registry('buildings', 'buildings.json'),
      npcs: registry('npc', 'npcs.json'),
      rooms: registry('rooms', 'rooms.json'),
      furniture: { types: registry('furniture/types', 'furniture.json.types'), placements: furniture },
      quests: requests.quests,
      dialogues: requests.dialogues,
      items,
      locations,
      taskboards: { types: registry('taskboards', 'taskboards.json.types'), placements: taskboards },
      patrols: {
        types: registry('patrols/types', 'patrols.json.types'),
        locations: registry('patrols/locations', 'patrols.json.locations')
      },
      containers: {
        ...(files['./containers/settings.json'] as object),
        types: registry('containers/types', 'containers.json.types'),
        lootTables: registry('loot-tables', 'containers.json.lootTables'), placements
      },
      audio: files['./audio.json'],
      story: files['./story.json'],
      hero: files['./hero.json'],
      settings: files['./settings.json'],
      ui: files['./ui.json'],
      daytime: files['./daytime.json'],
      difficulty: files['./difficulty.json'],
      skills: files['./skills.json'],
      advice: files['./advice.json'],
    }
  }
}
