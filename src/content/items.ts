import { CONTENT } from './catalogue'
import config from './ui/inventory.json' with { type: 'json' }
import type { ItemDefinition } from './types'
export const ITEM_SHEET = config.itemSheet
export const ITEMS = CONTENT.data.items as ItemDefinition[]
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(item => [item.id, item]))
