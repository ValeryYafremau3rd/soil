import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import type { InteractiveObject } from './InteractiveObject'

/**
 * Expose nearby prompts to the shared world selection.
 * @param {readonly InteractiveObject<Image>[]} objects - The objects supplied to this operation.
 * @param {Hero} hero - The hero supplied to this operation.
 * @param {InputActions} actions - The actions supplied to this operation.
 * @param {boolean} enabled - Whether this behavior is enabled.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function updateInteractiveObjects(
  objects: readonly InteractiveObject[],
  hero: Hero,
  actions: InputActions,
  enabled = true
): boolean {
  let opened = false

  for (const object of objects) opened = object.update(hero, actions, enabled && object.canInteractWith(hero)) || opened

  return opened
}
