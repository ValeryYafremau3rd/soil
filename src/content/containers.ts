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
export const CONTAINER_PLACEMENTS = [...CONTAINER_CONFIG.placements.filter(placement => placement.enabled !== false),
  ...roomContainerPlacements(LOCATIONS, BUILDINGS, ROOMS)]
export const CONTAINER_INTERACTION = CONTAINER_CONFIG.interaction
export const CONTAINER_SEEDS = buildContainerSeeds({ ...CONTAINER_CONFIG, placements: CONTAINER_PLACEMENTS }, ITEMS)
