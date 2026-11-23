import type { SavedInventory } from '../contracts/save'

/**
 * Add the new story item once without resetting previously searched containers.
 * @param {SavedInventory} saved - The saved supplied to this operation.
 * @returns {SavedInventory} The result described by the TypeScript return signature.
 */
export function migrateMotherJournal(saved: SavedInventory): SavedInventory {
  if (saved.motherJournalVersion) return saved

  const itemId = 'milena-mother-journal'
  const containerId = 'factory-roof-safe'
  const containers = { ...saved.containers }
  // The debug stock contains every item; it is not a collected story copy.
  const debugContainerId = 'living-district:apartments:apartment-21:developer-container'
  const storedItems = Object.entries(containers).filter(([id]) => id !== debugContainerId)
    .map(([, container]) => container.items)
  const alreadyPresent = [saved.items, ...storedItems]
    .some(items => items.some(item => item.itemId === itemId))
  const roof = containers[containerId]
  if (roof && !alreadyPresent) {
    containers[containerId] = { ...roof, items: [...roof.items, { itemId, quantity: 1 }] }
  }

  return { ...saved, motherJournalVersion: 1, containers }
}
