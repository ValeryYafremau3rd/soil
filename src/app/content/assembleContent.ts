import type { ContentInput } from './validateContent'
import type { ItemDefinition } from '../../content/types'
import type { QuestDefinition } from '../../domain/quests/quests'
import type { DialogueDefinition } from '../../domain/dialogue/dialogue'
import { buildFindItemRequests } from './findItemRequests.ts'
import { locationFiles } from './locationFiles.ts'
import { patrolFiles } from './patrolFiles.ts'
import { heroFiles } from './heroFiles.ts'
import { uiFiles } from './uiFiles.ts'

export interface ContentCatalogue { data: ContentInput; sources: Record<string, string> }

/** Assemble authored files independently of the filesystem and bundler. */
export function assembleContent(files: Record<string, unknown>): ContentCatalogue {
  const origins = new Map<object, string>()
  files = locationFiles(files, origins)
  const sources: Record<string, string> = {}
  files = patrolFiles(files, sources)
  files = heroFiles(files, sources)
  files = uiFiles(files, sources)
  function entries(folder: string): [string, unknown][] {
    const prefix = `./${folder}/`
    return Object.entries(files).filter(([path]) => path.startsWith(prefix)
      && path.endsWith('.json') && !path.slice(prefix.length).includes('/')).sort(([a], [b]) => a.localeCompare(b))
  }
  function registry(folder: string, target: string): Record<string, unknown> {
    return Object.fromEntries(entries(folder).map(([path, value]) => {
      const id = path.split('/').pop()!.slice(0, -5)
      sources[`${target}.${id}`] ??= `src/content/${path.slice(2)}`
      if (folder === 'dialogues') sources[`dialogues/${id}.json`] = `src/content/${path.slice(2)}`
      return [id, value]
    }))
  }
  function list(folder: string): Record<string, unknown>[] {
    const values = entries(folder).map(([path, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || (value as { id?: unknown }).id !== path.split('/').pop()!.slice(0, -5)) {
        throw new Error(`src/content/${path.slice(2)}: id must match the filename`)
      }
      return { path, value: value as Record<string, unknown> }
    })
    if (folder === 'locations') values.sort((a, b) => Number(a.value.order ?? 0) - Number(b.value.order ?? 0))
    return values.map(({ path, value }, index) => {
      sources[`${folder}.json[${index}]`] = origins.get(value) ?? `src/content/${path.slice(2)}`
      sources[`${folder}.json.${value.id}`] = sources[`${folder}.json[${index}]`]
      if (folder === 'locations' && Array.isArray(value.buildings)) for (const [i, building] of value.buildings.entries()) {
        if (origins.has(building)) sources[`locations.json[${index}].buildings[${i}]`] = origins.get(building)!
      }
      return value
    })
  }
  const placements: unknown[] = []
  const taskboards: unknown[] = []
  const furniture: unknown[] = []
  function collectPlacements(location: Record<string, unknown>, index: number, field: string, target: unknown[]): void {
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
  const requests = buildFindItemRequests(items as unknown as ItemDefinition[], list('quests') as unknown as QuestDefinition[],
    registry('dialogues', 'dialogues.json') as unknown as Record<string, DialogueDefinition>)
  for (const quest of requests.quests) {
    if (!sources[`quests.json.${quest.id}`] && quest.findItem) sources[`quests.json.${quest.id}`] = `src/content/items/${quest.findItem}.json`
  }
  return { sources, data: {
    buildings: registry('buildings', 'buildings.json'), npcs: registry('npcs', 'npcs.json'),
    rooms: registry('rooms', 'rooms.json'),
    furniture: { types: registry('furniture/types', 'furniture.json.types'), placements: furniture },
    quests: requests.quests, dialogues: requests.dialogues, items, locations,
    taskboards: { types: registry('taskboards', 'taskboards.json.types'), placements: taskboards },
    patrols: { types: registry('patrols/types', 'patrols.json.types'), locations: registry('patrols/locations', 'patrols.json.locations') },
    containers: { ...(files['./containers/settings.json'] as object),
      types: registry('containers/types', 'containers.json.types'),
      lootTables: registry('loot-tables', 'containers.json.lootTables'), placements },
    hero: files['./hero.json'], settings: files['./settings.json'], ui: files['./ui.json'], daytime: files['./daytime.json'], difficulty: files['./difficulty.json'], skills: files['./skills.json'], advice: files['./advice.json'],
  } }
}
