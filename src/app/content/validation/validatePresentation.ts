import { requireCondition,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'


export function validatePresentation(context: ContentContext) {
  const { input, locations, items, hero, ui, layers, initialTime, daytime } = context
requireCondition(hero.settings.attackTiming.minDamageMultiplier <= hero.settings.attackTiming.maxDamageMultiplier, 'hero.json.settings.attackTiming: minDamageMultiplier exceeds maxDamageMultiplier')
requireCondition(hero.settings.attackTiming.dotRadius < hero.settings.attackTiming.radius, 'hero.json.settings.attackTiming: dot must be smaller than outer ring')
requireCondition(initialTime.initialPhaseTravels < initialTime.travelsPerPhase * (initialTime.initialPhase === 'night' ? initialTime.nightDurationMultiplier : 1), 'daytime.json.initialPhaseTravels: must stay within the starting phase')
requireCondition(daytime.courierJobsPerDay.min <= daytime.courierJobsPerDay.max, 'daytime.json.courierJobsPerDay: min must not exceed max')
for (const [phase, { icon }] of Object.entries(daytime.phases)) {
    requireCondition(icon.x >= 0 && icon.y >= 0 && icon.x + icon.width <= daytime.iconSheet.width
      && icon.y + icon.height <= daytime.iconSheet.height, `daytime.json.phases.${phase}.icon: crop exceeds the icon sheet`)
  }
requireCondition(layers.outdoors < layers.interiorShade && layers.interiorShade < layers.building
    && layers.building < layers.roomShade && layers.roomShade < layers.room && layers.room < layers.actors
    && layers.actors < layers.hero && layers.hero < layers.daytimeTint && layers.daytimeTint < layers.hints,
  'settings.json.layers: expected outdoor scenery < shade < buildings < room shade < room < actors < hero < daytime tint < hints')
unique(items.map(item => item.id), 'items.json')
unique(locations.map(location => location.id), 'locations.json')
requireCondition(locations.some(location => location.id === (input.daytime as { initialLocationId: string }).initialLocationId), 'daytime.initialLocationId: unknown location')
unique(ui.menus.map(menu => menu.id), 'ui.json.menus')
unique(ui.menus.map(menu => menu.key), 'ui.json.menus keys')
}
