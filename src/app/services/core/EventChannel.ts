/** Typed events for changes that do not need an observable snapshot. */
export class EventChannel<Args extends unknown[]> {
  private readonly listeners = new Set<(...args: Args) => void>()

  /**
   * Perform subscribe for EventChannel.
   * @param {(...args: Args) => void} listener - Callback invoked when the observable value changes.
   * @returns {() => void} Callback that releases or performs the registered operation.
   */
  subscribe = (listener: (...args: Args) => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Perform emit for EventChannel.
   * @param {Args} args - The args supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  emit = (...args: Args): void => {
    for (const listener of this.listeners) listener(...args)
  }
}
