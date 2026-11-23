import type Phaser from 'phaser'
import type { BuildingDefinition } from '../../content/types'
import { prepareSprites } from '../rendering/prepareSprites'
import { Building } from './Building'
import { buildingSprites } from '../../content/buildings'

/** Buildings differ by authored views and geometry, not by duplicated subclasses. */
export class ConfiguredBuilding extends Building {
  /**
   * Initialize the ConfiguredBuilding instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {string} id - The id supplied to this operation.
   * @param {BuildingDefinition} definition - The definition supplied to this operation.
   * @param {number} x - Horizontal coordinate.
   * @param {number} groundY - The ground y supplied to this operation.
   * @returns {ConfiguredBuilding} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    id: string,
    definition: BuildingDefinition,
    x: number,
    groundY: number
  ) {
    prepareSprites(scene, buildingSprites(definition))
    super(scene, id, definition, x, groundY)
  }
}
