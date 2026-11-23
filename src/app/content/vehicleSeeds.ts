import type { ContainerSeed } from '../../domain/inventory/loot'
import config from '../../content/skills.json' with { type: 'json' }

/**
 * Perform vehicle seeds.
 * @param {readonly { id: string; locationId: string; }[]} vehicles - The vehicles supplied to this operation.
 * @returns {ContainerSeed[]} The result described by the TypeScript return signature.
 */
export function vehicleSeeds(vehicles: readonly {
  id: string
  locationId: string
}[]): ContainerSeed[] {
  return vehicles.flatMap(vehicle => ['parts', 'valuables'].map(kind => ({
    id: `${vehicle.id}:${kind}`, locationId: vehicle.locationId, name: 'Vehicle search',
    items: config.vehicleSearch[kind as 'parts' | 'valuables'],
  })))
}

