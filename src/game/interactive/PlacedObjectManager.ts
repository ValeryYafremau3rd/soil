import type { ObjectPlacement } from '../../content/types'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import type { InteractiveObject } from './InteractiveObject'
import { updateInteractiveObjects } from './updateInteractiveObjects.ts'

/** Shared location visibility and nearest-object interaction for placed props. */
export class PlacedObjectManager<T extends InteractiveObject & {
  readonly placement: ObjectPlacement
}> {
  protected readonly objects: readonly T[]

  /**
   * Initialize the PlacedObjectManager instance and its collaborators.
   * @param {readonly T[]} objects - The objects supplied to this operation.
   * @returns {PlacedObjectManager} The initialized instance.
   */
  constructor(objects: readonly T[]) {
    this.objects = objects
    this.setInside()
  }

  /**
   * Set inside.
   * @param {string | undefined} buildingId - The building id supplied to this operation.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @returns {void} Completes the operation without returning a value.
   */
  setInside(
    buildingId?: string,
    enabled = true
  ): void {
    for (const object of this.objects) object.setVisible(enabled && (object.placement.space === 'inside'
      ? object.placement.buildingId === buildingId : buildingId === undefined))
  }

  /**
   * Check whether interact with is allowed.
   * @param {Hero} hero - The hero supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  canInteractWith(hero: Hero): boolean {
    return this.objects.some(object => object.canInteractWith(hero))
  }

  /**
   * Perform update for PlacedObjectManager.
   * @param {Hero} hero - The hero supplied to this operation.
   * @param {InputActions} actions - The actions supplied to this operation.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  update(hero: Hero, actions: InputActions, enabled = true): boolean {
    return updateInteractiveObjects(this.objects, hero, actions, enabled)
  }
}
