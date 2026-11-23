/**
 * Perform move selection.
 * @param {number} current - The current supplied to this operation.
 * @param {number} count - The count supplied to this operation.
 * @param {number} direction - The direction supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function moveSelection(current: number, count: number, direction: number): number {
  if (count === 0) return 0

  return ((current + direction) % count + count) % count
}

export type SelectionMove = 'up' | 'down' | 'left' | 'right' | 'first' | 'last'

/**
 * Perform selection index.
 * @param {number} current - The current supplied to this operation.
 * @param {number} count - The count supplied to this operation.
 * @param {SelectionMove} move - The move supplied to this operation.
 * @param {boolean} wrap - The wrap supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function selectionIndex(
  current: number,
  count: number,
  move: SelectionMove,
  wrap = true
): number {
  if (count === 0 || move === 'first') return 0

  if (move === 'last') return count - 1

  if (current < 0) return 0

  const direction = move === 'up' || move === 'left' ? -1 : 1

  return wrap ? moveSelection(current, count, direction) : Math.max(0, Math.min(count - 1, current + direction))
}
