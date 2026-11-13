/** Typed events for changes that do not need an observable snapshot. */
export class EventChannel<Args extends unknown[]> {
  private readonly listeners = new Set<(...args: Args) => void>()

  subscribe = (listener: (...args: Args) => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  emit = (...args: Args): void => {
    for (const listener of this.listeners) listener(...args)
  }
}
