/**
 * Keyboard event capabilities consumed by menu navigation adapters.
 */
interface MenuKeyEvent {
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  nativeEvent: {
    isComposing: boolean
  }
}

/**
 * Check whether modified or composing is true.
 * @param {MenuKeyEvent} event - The event supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function isModifiedOrComposing(event: MenuKeyEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing
}
