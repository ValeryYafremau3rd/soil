export function moveSelection(current: number, count: number, direction: number): number {
  if (count === 0) return 0
  return ((current + direction) % count + count) % count
}
