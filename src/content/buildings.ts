import { CONTENT } from './catalogue'
import type { BuildingDefinition } from './types'
import { ROOMS } from './rooms'
export type { BuildingDefinition, BuildingView } from './types'
export const BUILDINGS = CONTENT.data.buildings as Readonly<Record<string, BuildingDefinition>>
export const HOUSE = BUILDINGS.house
export const FACTORY = BUILDINGS.factory

/**
 * Perform building sprites.
 * @param {BuildingDefinition} definition - The definition supplied to this operation.
 * @returns {SpriteDefinition[]} The result described by the TypeScript return signature.
 */
export function buildingSprites(definition: BuildingDefinition) {
  return [
    ...definition.sprites,
    ...(definition.rooms ?? []).map(binding => ROOMS[binding.type].sprite)
  ]
}
