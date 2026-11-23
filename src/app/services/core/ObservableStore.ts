import { EventChannel } from './EventChannel.ts'

/** A stable subscription boundary shared by React and the game; no framework objects cross it. */
export abstract class ObservableStore<T> {
  protected snapshot: T
  private readonly listeners = new EventChannel<[]>()

  /**
   * Initialize the ObservableStore instance and its collaborators.
   * @param {T} snapshot - State snapshot supplied to this operation.
   * @returns {ObservableStore} The initialized instance.
   */
  protected constructor(snapshot: T) {
    this.snapshot = snapshot
  }

  /**
   * Read snapshot.
   * @returns {T} The result described by the TypeScript return signature.
   */
  getSnapshot = (): T => this.snapshot

  /**
   * Perform subscribe for ObservableStore.
   * @param {() => void} listener - Callback invoked when the observable value changes.
   * @returns {() => void} Callback that releases or performs the registered operation.
   */
  subscribe = (listener: () => void): (() => void) => {
    return this.listeners.subscribe(listener)
  }

  /**
   * Perform publish for ObservableStore.
   * @param {T} snapshot - State snapshot supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  protected publish(snapshot: T): void {
    this.snapshot = snapshot
    this.listeners.emit()
  }
}
