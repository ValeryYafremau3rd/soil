import { vehicleSeeds } from '../app/content/vehicleSeeds'
import { FURNITURE } from './furniture'
import { CONTENT } from './catalogue'
import { buildContainerSeeds } from '../app/content/containerSeeds'
import type { ContainerConfiguration } from './types'
import { ITEMS } from './items.ts'
import { roomContainerPlacements } from '../app/content/roomContainerPlacements'
import { LOCATIONS } from './locations'
import { BUILDINGS } from './buildings'
import { ROOMS } from './rooms'
export type { ContainerPlacement } from './types'
export const CONTAINER_CONFIG = CONTENT.data.containers as ContainerConfiguration
export const CONTAINER_SHEET = CONTAINER_CONFIG.sheet
export const CONTAINER_TYPES = CONTAINER_CONFIG.types
const persistentPlacements = [...CONTAINER_CONFIG.placements.filter(placement => placement.enabled !== false),
...roomContainerPlacements(LOCATIONS, BUILDINGS, ROOMS)]
// Retain legacy safe storage for saves/deposits, but expose no developer safe in the world.
export const CONTAINER_PLACEMENTS = persistentPlacements.filter(placement => !placement.developerStock)
export const CONTAINER_INTERACTION = CONTAINER_CONFIG.interaction
export const VEHICLE_SEEDS = vehicleSeeds(FURNITURE.placements.filter(p => p.enabled !== false && FURNITURE.types[p.type].action === 'vehicle'))
export const CONTAINER_SEEDS = [
  ...buildContainerSeeds({ ...CONTAINER_CONFIG, placements: persistentPlacements }, ITEMS),
  ...VEHICLE_SEEDS
]
