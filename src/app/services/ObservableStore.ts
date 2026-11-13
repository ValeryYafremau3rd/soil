import { EventChannel } from './EventChannel.ts'

/** A stable subscription boundary shared by React and the game; no framework objects cross it. */
export abstract class ObservableStore<T> {
  protected snapshot: T
  private readonly listeners = new EventChannel<[]>()

  protected constructor(snapshot: T) { this.snapshot = snapshot }
  getSnapshot = (): T => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    return this.listeners.subscribe(listener)
  }
  protected publish(snapshot: T): void {
    this.snapshot = snapshot
    this.listeners.emit()
  }
}
