import type { Hero } from '../entities/Hero'
import type { InputActions } from '../input/KeyboardMouseInput'
import type { InteractiveObject } from './InteractiveObject'

/** Expose nearby prompts to the shared world selection. */
export function updateInteractiveObjects(objects: readonly InteractiveObject[], hero: Hero, actions: InputActions, enabled = true): boolean {
  let opened = false
  for (const object of objects) opened = object.update(hero, actions, enabled && object.canInteractWith(hero)) || opened
  return opened
}
