import type { NotesController, NotesSnapshot } from '../contracts/notes'
import type { TravelController } from '../contracts/travel'
import type { InventoryController } from '../contracts/inventory'
import { ObservableStore } from './ObservableStore.ts'

export class NotesService extends ObservableStore<NotesSnapshot> implements NotesController {
  private readonly known: Record<keyof NotesSnapshot, ReadonlySet<string>>
  constructor(catalogue: NotesSnapshot) {
    super({ locations: [...catalogue.locations], people: [...catalogue.people], items: [...catalogue.items] })
    this.known = { locations: new Set(catalogue.locations), people: new Set(catalogue.people), items: new Set(catalogue.items) }
  }
  private record(category: keyof NotesSnapshot, ids: readonly string[]): void {
    const added = [...new Set(ids)].filter(id => this.known[category].has(id) && !this.snapshot[category].includes(id))
    if (added.length) this.publish({ ...this.snapshot, [category]: [...this.snapshot[category], ...added] })
  }
  visitLocation = (id: string): void => this.record('locations', [id])
  meetPerson = (id: string): void => this.record('people', [id])
  discoverItems = (ids: readonly string[]): void => this.record('items', ids)
  restoreState = (_saved: NotesSnapshot): void => {
    // Older discovery lists cannot hide entries from the reference catalogue.
    void _saved
    this.publish({ locations: [...this.known.locations], people: [...this.known.people], items: [...this.known.items] })
  }
}

export function trackNotes(notes: NotesController, travel: Pick<TravelController, 'getSnapshot' | 'subscribe'>,
  inventory: Pick<InventoryController, 'getSnapshot' | 'subscribe'>, active: () => boolean): () => void {
  const record = () => {
    if (!active()) return
    notes.visitLocation(travel.getSnapshot().currentLocationId)
    notes.discoverItems(inventory.getSnapshot().items.filter(item => item.quantity > 0).map(item => item.itemId))
  }
  const stopTravel = travel.subscribe(record), stopInventory = inventory.subscribe(record)
  record()
  return () => { stopTravel(); stopInventory() }
}
