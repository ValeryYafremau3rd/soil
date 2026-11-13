const SECTIONS = {
  'location-transition': 'locationTransition',
  'consumable-buffs': 'consumableBuffs',
  perks: 'perks',
  menus: 'menus',
  stats: 'stats',
  'selection-keys': 'selectionKeys',
  controls: 'controls',
  rest: 'rest',
} as const

const INVENTORY_FIELDS = ['itemSheet', 'itemIconSize', 'detailIconSize', 'noteIconSize', 'gridColumns', 'minimumContainerSlots']

/** Assemble UI sections into the existing validated runtime format. */
export function uiFiles(files: Record<string, unknown>, sources: Record<string, string>): Record<string, unknown> {
  const paths = Object.keys(files).filter(path => path.startsWith('./ui/'))
  if (!paths.length) return files
  if ('./ui.json' in files) throw new Error('src/content/ui: duplicate UI definition ./ui.json')
  const expanded = { ...files }
  const ui: Record<string, unknown> = {}
  const consumed = new Set<string>()
  function read(name: string): unknown {
    const path = `./ui/${name}.json`
    if (!(path in files)) throw new Error(`src/content/ui/${name}.json: missing UI section`)
    consumed.add(path)
    delete expanded[path]
    return files[path]
  }
  const inventory = read('inventory')
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) throw new Error('src/content/ui/inventory.json: expected an object')
  Object.assign(ui, inventory)
  for (const field of Object.keys(inventory)) {
    if (!INVENTORY_FIELDS.includes(field)) throw new Error(`src/content/ui/inventory.json.${field}: unknown inventory field`)
  }
  // Also map missing inventory fields to their owning file.
  for (const field of INVENTORY_FIELDS) sources[`ui.json.${field}`] = `src/content/ui/inventory.json.${field}`
  for (const [name, field] of Object.entries(SECTIONS)) {
    ui[field] = read(name)
    sources[`ui.json.${field}`] = `src/content/ui/${name}.json`
  }
  for (const path of paths) {
    if (!consumed.has(path)) throw new Error(`src/content/${path.slice(2)}: unrecognized UI content file`)
  }
  sources['ui.json'] = 'src/content/ui'
  expanded['./ui.json'] = ui
  return expanded
}
