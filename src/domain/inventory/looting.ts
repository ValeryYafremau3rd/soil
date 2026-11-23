/**
 * Location and interior context used to determine whether looting is allowed.
 */
interface LootingSpace {
  buildingId?: string
  roomId?: string
}

/**
 * Private rooms are separate from one another and from the building's shared interior.
 * @param {LootingSpace & { space: "inside" | "outside"; }} container - The container supplied to this operation.
 * @param {readonly LootingSpace[]} people - The people supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function isContainerObserved(
  container: LootingSpace & {
    space: 'inside' | 'outside'
  },
  people: readonly LootingSpace[]
): boolean {
  return container.space === 'inside' && !!container.buildingId && people.some(person =>
    person.buildingId === container.buildingId && person.roomId === container.roomId)
}
