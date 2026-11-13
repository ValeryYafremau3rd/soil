import inventory from './ui/inventory.json' with { type: 'json' }
import locationTransition from './ui/location-transition.json' with { type: 'json' }
import consumableBuffs from './ui/consumable-buffs.json' with { type: 'json' }
import perks from './ui/perks.json' with { type: 'json' }
import menus from './ui/menus.json' with { type: 'json' }
import stats from './ui/stats.json' with { type: 'json' }
import selectionKeys from './ui/selection-keys.json' with { type: 'json' }
import controls from './ui/controls.json' with { type: 'json' }
import rest from './ui/rest.json' with { type: 'json' }
import type { ConsumableBuffDefinition } from '../domain/character/perks'

// Static imports also keep service tests independent of Vite's content discovery.
export const UI_CONFIG = {
  ...inventory, locationTransition, consumableBuffs: consumableBuffs as ConsumableBuffDefinition[],
  perks, menus, stats, selectionKeys, controls, rest,
}
