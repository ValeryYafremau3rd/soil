import type { ObjectPlacement } from '../../content/types'
import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import type { InteractiveObject } from './InteractiveObject'
import { updateInteractiveObjects } from './updateInteractiveObjects.ts'

/** Shared location visibility and nearest-object interaction for placed props. */
export class PlacedObjectManager<T extends InteractiveObject & { readonly placement: ObjectPlacement }> {
  protected readonly objects: readonly T[]

  constructor(objects: readonly T[]) { this.objects = objects; this.setInside() }

  setInside(buildingId?: string, enabled = true): void {
    for (const object of this.objects) object.setVisible(enabled && (object.placement.space === 'inside'
      ? object.placement.buildingId === buildingId : buildingId === undefined))
  }

  canInteractWith(hero: Hero): boolean { return this.objects.some(object => object.canInteractWith(hero)) }

  update(hero: Hero, actions: InputActions, enabled = true): boolean {
    return updateInteractiveObjects(this.objects, hero, actions, enabled)
  }
}
