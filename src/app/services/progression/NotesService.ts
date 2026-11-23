import type { NotesController, NotesSnapshot } from '../../contracts/notes'
import type { TravelController } from '../../contracts/travel'
import type { InventoryController } from '../../contracts/inventory'
import { ObservableStore } from '../core/ObservableStore.ts'

/**
 * Owns notes service state and behavior.
 */
export class NotesService extends ObservableStore<NotesSnapshot> implements NotesController {
  private readonly known: Record<keyof NotesSnapshot, ReadonlySet<string>>

  /**
   * Initialize the NotesService instance and its collaborators.
   * @param {NotesSnapshot} catalogue - The catalogue supplied to this operation.
   * @returns {NotesService} The initialized instance.
   */
  constructor(catalogue: NotesSnapshot) {
    super({
      locations: [...catalogue.locations],
      people: [...catalogue.people],
      items: [...catalogue.items]
    })
    this.known = {
      locations: new Set(catalogue.locations),
      people: new Set(catalogue.people),
      items: new Set(catalogue.items)
    }
  }

  /**
   * Perform record for NotesService.
   * @param {keyof NotesSnapshot} category - The category supplied to this operation.
   * @param {readonly string[]} ids - The ids supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private record(
    category: keyof NotesSnapshot,
    ids: readonly string[]
  ): void {
    const added = [...new Set(ids)].filter(id => this.known[category].has(id) && !this.snapshot[category].includes(id))
    if (added.length) this.publish({ ...this.snapshot, [category]: [...this.snapshot[category], ...added] })
  }

  /**
   * Perform visit location for NotesService.
   * @param {string} id - The id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  visitLocation = (id: string): void => this.record('locations', [id])

  /**
   * Perform meet person for NotesService.
   * @param {string} id - The id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  meetPerson = (id: string): void => this.record('people', [id])

  /**
   * Perform discover items for NotesService.
   * @param {readonly string[]} ids - The ids supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  discoverItems = (ids: readonly string[]): void => this.record('items', ids)

  /**
   * Restore state.
   * @param {NotesSnapshot} _saved - The  saved supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  restoreState = (_saved: NotesSnapshot): void => {
    // Older discovery lists cannot hide entries from the reference catalogue.
    void _saved
    this.publish({
      locations: [...this.known.locations],
      people: [...this.known.people],
      items: [...this.known.items]
    })
  }
}

/**
 * Perform track notes.
 * @param {NotesController} notes - The notes supplied to this operation.
 * @param {Pick<TravelController, "getSnapshot" | "subscribe">} travel - The travel supplied to this operation.
 * @param {Pick<InventoryController, "getSnapshot" | "subscribe">} inventory - Inventory capability used to read or transact items.
 * @param {() => boolean} active - The active supplied to this operation.
 * @returns {() => void} Callback that releases or performs the registered operation.
 */
export function trackNotes(
  notes: NotesController,
  travel: Pick<TravelController, 'getSnapshot' | 'subscribe'>,
  inventory: Pick<InventoryController, 'getSnapshot' | 'subscribe'>,
  active: () => boolean
): () => void {
  /**
   * Perform record.
   * @returns {void} Completes the operation without returning a value.
   */
  const record = () => {
    if (!active()) return

    notes.visitLocation(travel.getSnapshot().currentLocationId)
    notes.discoverItems(inventory.getSnapshot().items.filter(item => item.quantity > 0).map(item => item.itemId))
  }
  const stopTravel = travel.subscribe(record), stopInventory = inventory.subscribe(record)
  record()

  return () => {
    stopTravel()
    stopInventory()
  }
}
