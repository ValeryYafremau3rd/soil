import type Phaser from 'phaser'
import type { BuildingDefinition } from '../../content/types'
import { prepareSprites } from '../rendering/prepareSprites'
import { Building } from './Building'
import { buildingSprites } from '../../content/buildings'

/** Buildings differ by authored views and geometry, not by duplicated subclasses. */
export class ConfiguredBuilding extends Building {
  constructor(scene: Phaser.Scene, id: string, definition: BuildingDefinition, x: number, groundY: number) {
    prepareSprites(scene, buildingSprites(definition))
    super(scene, id, definition, x, groundY)
  }
}
