interface LootingSpace { buildingId?: string; roomId?: string }

/** Private rooms are separate from one another and from the building's shared interior. */
export function isContainerObserved(container: LootingSpace & { space: 'inside' | 'outside' }, people: readonly LootingSpace[]): boolean {
  return container.space === 'inside' && !!container.buildingId && people.some(person =>
    person.buildingId === container.buildingId && person.roomId === container.roomId)
}
